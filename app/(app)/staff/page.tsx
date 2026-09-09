import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { monthBounds, yen, visitTotal } from "@/lib/analytics";
import { givenNameInitial as initial } from "@/lib/format";
import Topbar from "../Topbar";
import SettingsTabs from "../SettingsTabs";
import NewStaffForm from "./NewStaffForm";
import StaffToggleButton from "./StaffToggleButton";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";

  const now = new Date();
  const thisMonth = monthBounds(now, 0);

  const [staffList, allStores] = await Promise.all([
    prisma.staff.findMany({
      where: { storeId: storeId ?? undefined, role: { not: "OWNER" } },
      include: {
        store: true,
        visits: { where: { date: { gte: thisMonth.start, lt: thisMonth.end } } },
        primaryCustomers: { select: { id: true } },
      },
      orderBy: [{ active: "desc" }, { role: "asc" }, { hireDate: "asc" }],
    }),
    prisma.store.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const yearsOfService = (hireDate: Date | null) => {
    if (!hireDate) return "-";
    const years = (now.getTime() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return years < 1 ? "1年未満" : `${Math.floor(years)}年`;
  };

  const canAddStaff = session.role === "OWNER" || session.role === "MANAGER";

  return (
    <>
      <Topbar title="設定・スタッフ" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <SettingsTabs />
        {canAddStaff && (
          <NewStaffForm
            isOwner={session.role === "OWNER"}
            fixedStoreId={storeId}
            stores={allStores.map((s) => ({ id: s.id, name: s.name }))}
          />
        )}
        <div className="staff-grid">
          {staffList.map((s) => {
            const monthTotal = s.visits.reduce((a, v) => a + visitTotal(v), 0);
            const repeatVisits = s.visits.length; // 参考値：今月の担当施術件数
            const canEdit = session.role === "OWNER" || (session.role === "MANAGER" && session.storeId === s.storeId);
            return (
              <div className="card staff-card" key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
                <div className="staff-top">
                  <div className="staff-avatar" style={{ background: `var(--store-${s.store?.colorKey ?? "a"})` }}>
                    {initial(s.name)}
                  </div>
                  <div>
                    <div className="staff-name">
                      {s.name}
                      {!s.active && <span className="card-sub" style={{ margin: 0, marginLeft: 6 }}>（退職・非表示）</span>}
                    </div>
                    <div className="staff-role">
                      {s.store?.name}・{s.title}
                    </div>
                  </div>
                </div>
                <span className={`perm-chip ${s.role === "MANAGER" ? "perm-manager" : "perm-staff"}`}>
                  {s.role === "MANAGER" ? "マネージャー権限" : "スタッフ権限"}
                </span>
                <div className="staff-stats">
                  <div>
                    <div className="staff-stat-label">今月売上</div>
                    <div className="staff-stat-value">{yen(monthTotal)}</div>
                  </div>
                  <div>
                    <div className="staff-stat-label">指名客数</div>
                    <div className="staff-stat-value">{s.primaryCustomers.length}</div>
                  </div>
                  <div>
                    <div className="staff-stat-label">勤続年数</div>
                    <div className="staff-stat-value">{yearsOfService(s.hireDate)}</div>
                  </div>
                  <div>
                    <div className="staff-stat-label">今月施術件数</div>
                    <div className="staff-stat-value">{repeatVisits}件</div>
                  </div>
                </div>
                {canEdit && (
                  <div>
                    <StaffToggleButton id={s.id} active={s.active} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {staffList.length === 0 && <div className="card-sub">この店舗にはまだスタッフが登録されていません。</div>}
      </div>
    </>
  );
}
