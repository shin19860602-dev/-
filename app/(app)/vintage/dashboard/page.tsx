import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/analytics";
import { aggregateVintageSales, vintageReportMonth } from "@/lib/vintageSalesReport";
import Topbar from "../../Topbar";
import BarList from "../../charts/BarList";
import VintageTabs from "../VintageTabs";
import { resolveVintageAccess } from "../access";
import VintagePeriodControls from "../VintagePeriodControls";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

export default async function VintageDashboardPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const access = await resolveVintageAccess();
  if (!access.session) redirect("/");
  const { session, store, hasAccess } = access;

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

  const selectedMonth = vintageReportMonth((await searchParams).month);
  if (!selectedMonth) return <div className="view"><VintageTabs /><div className="card card-pad" role="alert">年月が正しくありません。<a href="/vintage/dashboard">今月の売上を表示する</a></div></div>;

  const monthSales = await prisma.vintageSale.findMany({
    where: { storeId: store.id, date: { gte: selectedMonth.start, lt: selectedMonth.end } },
  });

  const monthTotal = monthSales.reduce((a, s) => a + s.amount, 0);
  const dailyRows = aggregateVintageSales(selectedMonth, monthSales);
  const cashTotal = dailyRows.reduce((sum, row) => sum + row.cash, 0);
  const creditTotal = dailyRows.reduce((sum, row) => sum + row.credit, 0);
  const unknownTotal = dailyRows.reduce((sum, row) => sum + row.unknown, 0);

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
        <VintageTabs />
        <VintagePeriodControls key={selectedMonth.value} month={selectedMonth.value} />

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title">選択した月の売上</div>
          <div className="card-sub">
            {selectedMonth.year}年{selectedMonth.month}月
          </div>
          <div className="card-sub">現金売上 {yen(cashTotal)} ／ クレジット売上 {yen(creditTotal)}</div>
          {unknownTotal !== 0 && <div className="card-sub">支払方法未登録 {yen(unknownTotal)}（合計には含み、現金・クレジットには含めていません）</div>}
          <div className="kpi-value" style={{ marginTop: 4 }}>
            {yen(monthTotal)}
          </div>
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">分類別売上構成比（選択月）</div>
            <div className="card-sub">売上登録時に選んだ分類の内訳</div>
            <BarList bars={categoryBars} valueFormatter={yen} />
            {categoryBars.length === 0 && <div className="card-sub">選択した月の記録はありません。</div>}
          </div>
          <div className="card card-pad">
            <div className="card-title">ブランド別売上構成比（選択月）</div>
            <div className="card-sub">売上登録時に選んだブランドの内訳</div>
            <BarList bars={brandBars} valueFormatter={yen} />
            {brandBars.length === 0 && <div className="card-sub">対象ブランドの記録はまだありません。</div>}
          </div>
        </div>
      </div>
    </>
  );
}
