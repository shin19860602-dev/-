import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/analytics";
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

  const staffList = await prisma.staff.findMany({
    where: { storeId: storeId ?? undefined, role: { not: "OWNER" } },
    include: { store: true },
    orderBy: [{ active: "desc" }, { role: "asc" }, { hireDate: "asc" }],
  });
  const staffIds = staffList.map((s) => s.id);

  const salaries = await prisma.salary.findMany({ where: { staffId: { in: staffIds }, yearMonth: selectedMonthValue } });
  const salaryByStaff = new Map(salaries.map((s) => [s.staffId, s]));

  const rows = staffList.map((s) => ({
    staff: s,
    values:
      salaryByStaff.get(s.id) ??
      {
        baseSalary: 0,
        serviceCommission: 0,
        productCommission: 0,
        specialAllowance: 0,
        employmentInsurance: 0,
        incomeTax: 0,
        residentTax: 0,
        memo: null as string | null,
      },
  }));

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
              insuranceRate={s.store?.insuranceRate ?? 0}
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
            ? "※雇用保険は支給合計×料率、所得税は国税庁の源泉徴収税額表（甲欄・0人）から自動計算します（保存前なら編集可）。住民税は自治体の通知額を手入力してください。登録・編集できるのはオーナーのみです。"
            : "※この店舗のスタッフの給与です（閲覧のみ）。"}
        </div>
      </div>
    </>
  );
}
