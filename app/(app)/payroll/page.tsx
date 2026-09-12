import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { monthBounds, yen } from "@/lib/analytics";
import { salaryGross, salaryDeduction, salaryNet } from "@/lib/payroll";
import Topbar from "../Topbar";
import SettingsTabs from "../SettingsTabs";
import MonthSelect from "../MonthSelect";
import SalaryRow from "./SalaryRow";
import PayrollPasswordGate from "./PayrollPasswordGate";
import PayrollPasswordForm from "./PayrollPasswordForm";
import InsuranceRateForm from "./InsuranceRateForm";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ store?: string; month?: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");

  const canEdit = session.role === "OWNER";

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";

  // スタッフ・マネージャーは、自店舗のパスワードを入力するまで中身を見せない
  const unlocked = canEdit || session.payrollUnlockedStoreId === storeId;
  if (!unlocked) {
    return (
      <>
        <Topbar title="設定・給料" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
        <div className="view">
          <SettingsTabs />
          <PayrollPasswordGate storeId={storeId!} />
        </div>
      </>
    );
  }

  const now = new Date();
  const monthOptions: { value: string; label: string }[] = [];
  {
    let y = now.getFullYear();
    let m = now.getMonth();
    for (let i = 0; i < 24; i++) {
      monthOptions.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${y}年${m + 1}月` });
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    }
  }
  const defaultMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const selectedMonthValue = sp.month && monthOptions.some((o) => o.value === sp.month) ? sp.month : defaultMonthValue;
  const [selYear, selMonth] = selectedMonthValue.split("-").map(Number);
  const selectedMonthRange = monthBounds(new Date(selYear, selMonth - 1, 1), 0);

  const staffList = await prisma.staff.findMany({
    where: { storeId: storeId ?? undefined, role: { not: "OWNER" } },
    include: { store: true },
    orderBy: [{ active: "desc" }, { role: "asc" }, { hireDate: "asc" }],
  });
  const staffIds = staffList.map((s) => s.id);

  const [salaries, monthVisits] = await Promise.all([
    prisma.salary.findMany({ where: { staffId: { in: staffIds }, yearMonth: selectedMonthValue } }),
    prisma.visit.findMany({
      where: { staffId: { in: staffIds }, date: { gte: selectedMonthRange.start, lt: selectedMonthRange.end } },
      select: { staffId: true, amount: true, productAmount: true },
    }),
  ]);
  const salaryByStaff = new Map(salaries.map((s) => [s.staffId, s]));

  // その月の技術売上・商品売上（歩合手当の自動計算に使う）
  const salesByStaff = new Map<string, { service: number; product: number }>();
  for (const v of monthVisits) {
    const cur = salesByStaff.get(v.staffId) ?? { service: 0, product: 0 };
    cur.service += v.amount;
    cur.product += v.productAmount ?? 0;
    salesByStaff.set(v.staffId, cur);
  }

  const rows = staffList.map((s) => {
    const saved = salaryByStaff.get(s.id);
    const sales = salesByStaff.get(s.id) ?? { service: 0, product: 0 };
    const insuranceRate = s.store?.insuranceRate ?? 0;

    if (saved) {
      return { staff: s, values: saved };
    }

    // 未登録の月は、実績と設定済みの歩合率・保険料率から目安額を自動計算して初期値にする
    const baseSalary = 0;
    const serviceCommission = Math.round((sales.service * s.serviceCommissionRate) / 100);
    const productCommission = Math.round((sales.product * s.productCommissionRate) / 100);
    const specialAllowance = 0;
    const employmentInsurance = Math.round(((baseSalary + serviceCommission + productCommission + specialAllowance) * insuranceRate) / 100);
    return {
      staff: s,
      values: {
        baseSalary,
        serviceCommission,
        productCommission,
        specialAllowance,
        employmentInsurance,
        incomeTax: 0,
        residentTax: 0,
        memo: null as string | null,
      },
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.gross += salaryGross(r.values);
      acc.deduction += salaryDeduction(r.values);
      acc.net += salaryNet(r.values);
      return acc;
    },
    { gross: 0, deduction: 0, net: 0 }
  );

  const settingsStores = canEdit
    ? await prisma.store.findMany({
        where: storeId ? { id: storeId } : undefined,
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, payrollPassword: true, insuranceRate: true },
      })
    : [];

  return (
    <>
      <Topbar title="設定・給料" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <SettingsTabs />

        {canEdit && (
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <div className="card card-pad">
              <div className="card-title">給料閲覧用パスワード</div>
              <div className="card-sub">スタッフ・マネージャーが自店舗の給料を見る際に入力するパスワードです。</div>
              <div>
                {settingsStores.map((s) => (
                  <PayrollPasswordForm key={s.id} storeId={s.id} storeName={s.name} isSet={!!s.payrollPassword} />
                ))}
              </div>
            </div>
            <div className="card card-pad">
              <div className="card-title">雇用保険料率</div>
              <div className="card-sub">労働者負担分の料率（%）。年度ごとに改定されるため、毎年確認して更新してください。</div>
              <div>
                {settingsStores.map((s) => (
                  <InsuranceRateForm key={s.id} storeId={s.id} storeName={s.name} rate={s.insuranceRate} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="filters" style={{ marginBottom: 16 }}>
          <MonthSelect options={monthOptions} current={selectedMonthValue} />
          <div style={{ flex: 1 }} />
          <span className="card-sub" style={{ margin: 0 }}>
            支給合計 <strong style={{ color: "var(--text)" }}>{yen(totals.gross)}</strong>・控除合計{" "}
            <strong style={{ color: "var(--text)" }}>{yen(totals.deduction)}</strong>・差引合計{" "}
            <strong style={{ color: "var(--text)" }}>{yen(totals.net)}</strong>
          </span>
        </div>

        <div className="card" style={{ marginTop: 0, padding: "4px 20px" }}>
          {rows.map(({ staff: s, values }) => (
            <SalaryRow
              key={s.id}
              staffId={s.id}
              staffName={s.name}
              storeName={s.store?.name ?? ""}
              yearMonth={selectedMonthValue}
              baseSalary={values.baseSalary}
              serviceCommission={values.serviceCommission}
              productCommission={values.productCommission}
              specialAllowance={values.specialAllowance}
              employmentInsurance={values.employmentInsurance}
              incomeTax={values.incomeTax}
              residentTax={values.residentTax}
              memo={values.memo ?? ""}
              serviceCommissionRate={s.serviceCommissionRate}
              productCommissionRate={s.productCommissionRate}
              canEdit={canEdit}
            />
          ))}
          {staffList.length === 0 && (
            <div className="card-sub" style={{ padding: "16px 0" }}>
              この店舗にはまだスタッフが登録されていません。
            </div>
          )}
        </div>

        <div className="card-sub" style={{ marginTop: 10 }}>
          {canEdit
            ? "※技術・商品歩合手当と雇用保険は目安額を自動計算します（保存前なら編集可）。所得税・住民税は税額表や自治体の通知額を参照する必要があるため手入力です。登録・編集できるのはオーナーのみです。"
            : "※この店舗のスタッフの給与です（閲覧のみ）。"}
        </div>
      </div>
    </>
  );
}
