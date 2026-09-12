import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/analytics";
import Topbar from "../Topbar";
import SettingsTabs from "../SettingsTabs";
import MonthSelect from "../MonthSelect";
import SalaryRow from "./SalaryRow";
import PayrollPasswordGate from "./PayrollPasswordGate";
import PayrollPasswordForm from "./PayrollPasswordForm";

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

  const salaries = await prisma.salary.findMany({
    where: { staffId: { in: staffList.map((s) => s.id) }, yearMonth: selectedMonthValue },
  });
  const salaryByStaff = new Map(salaries.map((s) => [s.staffId, s]));
  const totalAmount = salaries.reduce((a, s) => a + s.amount, 0);

  const passwordStores = canEdit
    ? await prisma.store.findMany({
        where: storeId ? { id: storeId } : undefined,
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, payrollPassword: true },
      })
    : [];

  return (
    <>
      <Topbar title="設定・給料" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <SettingsTabs />

        {canEdit && (
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="card-title">給料閲覧用パスワード</div>
            <div className="card-sub">スタッフ・マネージャーが自店舗の給料を見る際に入力するパスワードです。店舗ごとに設定できます。</div>
            <div>
              {passwordStores.map((s) => (
                <PayrollPasswordForm key={s.id} storeId={s.id} storeName={s.name} isSet={!!s.payrollPassword} />
              ))}
            </div>
          </div>
        )}

        <div className="filters" style={{ marginBottom: 16 }}>
          <MonthSelect options={monthOptions} current={selectedMonthValue} />
          <div style={{ flex: 1 }} />
          <span className="card-sub" style={{ margin: 0 }}>
            この月の合計 <strong style={{ color: "var(--text)" }}>{yen(totalAmount)}</strong>（{salaries.length}名分登録済み）
          </span>
        </div>

        <div className="card" style={{ marginTop: 0, padding: "4px 20px" }}>
          {staffList.map((s) => {
            const salary = salaryByStaff.get(s.id);
            return (
              <SalaryRow
                key={s.id}
                staffId={s.id}
                staffName={s.name}
                storeName={s.store?.name ?? ""}
                yearMonth={selectedMonthValue}
                amount={salary?.amount ?? null}
                memo={salary?.memo ?? ""}
                canEdit={canEdit}
              />
            );
          })}
          {staffList.length === 0 && (
            <div className="card-sub" style={{ padding: "16px 0" }}>
              この店舗にはまだスタッフが登録されていません。
            </div>
          )}
        </div>

        <div className="card-sub" style={{ marginTop: 10 }}>
          {canEdit
            ? "※登録・編集できるのはオーナーのみです。スタッフ・マネージャーの画面にはパスワード入力後、閲覧専用で表示されます。"
            : "※この店舗のスタッフの給与です（閲覧のみ）。"}
        </div>
      </div>
    </>
  );
}
