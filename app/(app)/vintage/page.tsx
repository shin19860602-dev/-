import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { monthBounds, yen } from "@/lib/analytics";
import Topbar from "../Topbar";
import BarList from "../charts/BarList";
import NewStaffForm from "../staff/NewStaffForm";
import StaffToggleButton from "../staff/StaffToggleButton";
import VintageSaleForm from "./VintageSaleForm";
import VintageSalesTable from "./VintageSalesTable";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

export default async function VintagePage() {
  const session = await requireSession();
  if (!session) redirect("/");

  const store = await prisma.store.findFirst({ where: { kind: "VINTAGE" } });
  const isOwner = session.role === "OWNER";
  const hasAccess = isOwner || (!!store && session.storeId === store.id);

  if (!store || !hasAccess) {
    return (
      <>
        <Topbar title="古着倉庫KUJEKUJE" scopeLabel="-" roleLabel={ROLE_LABEL[session.role!]} />
        <div className="view">
          <div className="card card-pad">
            <div className="card-title">閲覧権限がありません</div>
            <div className="card-sub">この画面は古着倉庫KUJEKUJEのスタッフとオーナーのみが利用できます。</div>
          </div>
        </div>
      </>
    );
  }

  const now = new Date();
  const thisMonth = monthBounds(now, 0);
  const canAddStaff = session.role === "OWNER" || session.role === "MANAGER";

  const [monthSales, staffList] = await Promise.all([
    prisma.vintageSale.findMany({
      where: { storeId: store.id, date: { gte: thisMonth.start, lt: thisMonth.end } },
      include: { staff: true },
      orderBy: { date: "desc" },
    }),
    prisma.staff.findMany({
      where: { storeId: store.id, role: { not: "OWNER" } },
      orderBy: [{ active: "desc" }, { role: "asc" }, { hireDate: "asc" }],
    }),
  ]);

  const monthTotal = monthSales.reduce((a, s) => a + s.amount, 0);

  const categoryTotals = new Map<string, number>();
  const brandTotals = new Map<string, number>();
  for (const s of monthSales) {
    const catKey = s.category || "未分類";
    categoryTotals.set(catKey, (categoryTotals.get(catKey) ?? 0) + s.amount);
    if (s.brand) brandTotals.set(s.brand, (brandTotals.get(s.brand) ?? 0) + s.amount);
  }
  const categoryTotalSum = [...categoryTotals.values()].reduce((a, v) => a + v, 0) || 1;
  const categoryBars = [...categoryTotals.entries()]
    .map(([key, value]) => ({ key, label: `${key} ${Math.round((value / categoryTotalSum) * 100)}%`, color: "var(--store-d)", value }))
    .sort((a, b) => b.value - a.value);
  const brandTotalSum = [...brandTotals.values()].reduce((a, v) => a + v, 0) || 1;
  const brandBars = [...brandTotals.entries()]
    .map(([key, value]) => ({ key, label: `${key} ${Math.round((value / brandTotalSum) * 100)}%`, color: "var(--store-d)", value }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <Topbar title="古着倉庫KUJEKUJE" scopeLabel="古着部門" roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <VintageSaleForm storeId={store.id} />

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title">今月の売上</div>
          <div className="card-sub">{now.getFullYear()}年{now.getMonth() + 1}月</div>
          <div className="kpi-value" style={{ marginTop: 4 }}>{yen(monthTotal)}</div>
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">分類別売上構成比（今月）</div>
            <div className="card-sub">売上登録時に選んだ分類の内訳</div>
            <BarList bars={categoryBars} valueFormatter={yen} />
            {categoryBars.length === 0 && <div className="card-sub">今月の記録はまだありません。</div>}
          </div>
          <div className="card card-pad">
            <div className="card-title">ブランド別売上構成比（今月）</div>
            <div className="card-sub">ノースフェイス・アディダス・ナイキ・コロンビア</div>
            <BarList bars={brandBars} valueFormatter={yen} />
            {brandBars.length === 0 && <div className="card-sub">対象ブランドの記録はまだありません。</div>}
          </div>
        </div>

        <div className="card card-pad" style={{ marginTop: 0 }}>
          <div className="card-title">売上履歴（今月）</div>
          <VintageSalesTable sales={monthSales} canEdit={true} />
        </div>

        {canAddStaff && (
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <div className="card-title">スタッフ管理</div>
            <NewStaffForm isOwner={isOwner} fixedStoreId={store.id} stores={[{ id: store.id, name: store.name }]} />
            {staffList.map((s) => (
              <div className="list-row" key={s.id}>
                <div className="grow">
                  <div className="title" style={{ opacity: s.active ? 1 : 0.5 }}>
                    {s.name}
                    {!s.active && <span className="card-sub" style={{ margin: 0, marginLeft: 6 }}>（退職・非表示）</span>}
                  </div>
                  <div className="meta">{s.title}</div>
                </div>
                <StaffToggleButton id={s.id} active={s.active} />
              </div>
            ))}
            {staffList.length === 0 && <div className="card-sub">まだスタッフが登録されていません。</div>}
          </div>
        )}
      </div>
    </>
  );
}
