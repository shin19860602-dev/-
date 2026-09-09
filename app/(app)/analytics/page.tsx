import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { monthBounds, pctDelta, repeatRate, yen, visitTotal } from "@/lib/analytics";
import Topbar from "../Topbar";
import LineChart from "../charts/LineChart";
import BarList from "../charts/BarList";

const CATEGORY_RULES: { key: string; label: string; match: (menu: string) => boolean }[] = [
  { key: "cut", label: "カット", match: (m) => m.includes("カット") && !m.includes("カラー") && !m.includes("パーマ") },
  { key: "color", label: "カラー", match: (m) => m.includes("カラー") },
  { key: "perm", label: "パーマ", match: (m) => m.includes("パーマ") && !m.includes("まつ毛") },
  { key: "treatment", label: "トリートメント／ヘッドスパ", match: (m) => m.includes("トリートメント") || m.includes("ヘッドスパ") },
  { key: "lash", label: "まつ毛エクステ・パーマ", match: (m) => m.includes("まつ毛") },
  { key: "other", label: "その他", match: () => true },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");
  if (session.role !== "OWNER") {
    return (
      <>
        <Topbar title="集計・分析" scopeLabel="-" roleLabel={session.role === "MANAGER" ? "マネージャー権限" : "スタッフ権限"} />
        <div className="view">
          <div className="card card-pad">
            <div className="card-title">閲覧権限がありません</div>
            <div className="card-sub">集計・分析はオーナーのみが閲覧できます。</div>
          </div>
        </div>
      </>
    );
  }

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";

  const now = new Date();
  const thisMonth = monthBounds(now, 0);
  const lastMonth = monthBounds(now, -1);
  const sixMonthsAgo = monthBounds(now, -5);
  const lastYearSameMonth = monthBounds(now, -12);

  const [thisMonthVisits, allStores, lastMonthByStore, lastYearByStore] = await Promise.all([
    prisma.visit.findMany({
      where: { storeId: storeId ?? undefined, date: { gte: thisMonth.start, lt: thisMonth.end } },
      select: { menuName: true, amount: true, productAmount: true, pointAmount: true, storeId: true },
    }),
    prisma.store.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.visit.findMany({
      where: { storeId: storeId ?? undefined, date: { gte: lastMonth.start, lt: lastMonth.end } },
      select: { amount: true, productAmount: true, pointAmount: true, storeId: true },
    }),
    prisma.visit.findMany({
      where: { storeId: storeId ?? undefined, date: { gte: lastYearSameMonth.start, lt: lastYearSameMonth.end } },
      select: { amount: true, productAmount: true, pointAmount: true, storeId: true },
    }),
  ]);

  // カテゴリ別売上構成比（施術メニューは種類別、店販・ポイントはまとめて1カテゴリずつ）
  const categoryTotals = new Map<string, number>();
  let productTotal = 0;
  let pointTotal = 0;
  for (const v of thisMonthVisits) {
    const cat = CATEGORY_RULES.find((r) => r.match(v.menuName))!;
    categoryTotals.set(cat.key, (categoryTotals.get(cat.key) ?? 0) + v.amount);
    productTotal += v.productAmount ?? 0;
    pointTotal += v.pointAmount ?? 0;
  }
  if (productTotal > 0) categoryTotals.set("product", productTotal);
  if (pointTotal > 0) categoryTotals.set("point", pointTotal);
  const categoryTotal = [...categoryTotals.values()].reduce((a, v) => a + v, 0) || 1;
  const CATEGORY_LABELS: Record<string, string> = {
    product: "店販",
    point: "ポイント",
    ...Object.fromEntries(CATEGORY_RULES.map((r) => [r.key, r.label])),
  };
  const categoryBars = [...categoryTotals.keys()]
    .map((key) => ({ key, label: CATEGORY_LABELS[key], color: "var(--accent)", value: categoryTotals.get(key)! }))
    .sort((a, b) => b.value - a.value);

  // リピート率推移（6ヶ月）
  const monthLabels: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const b = monthBounds(now, -i);
    monthLabels.push({ label: `${b.start.getMonth() + 1}月`, start: b.start, end: b.end });
  }
  const repeatValues = await Promise.all(monthLabels.map((m) => repeatRate(storeId, m.start, m.end)));

  // 店舗別サマリー（前月比・前年同月比）
  const storeSummaries = await Promise.all(
    allStores
      .filter((s) => !storeId || s.id === storeId)
      .map(async (s) => {
        const visits = thisMonthVisits.filter((v) => v.storeId === s.id);
        const revenue = visits.reduce((a, v) => a + visitTotal(v), 0);
        const lastRevenue = lastMonthByStore.filter((v) => v.storeId === s.id).reduce((a, v) => a + visitTotal(v), 0);
        const lastYearRevenue = lastYearByStore.filter((v) => v.storeId === s.id).reduce((a, v) => a + visitTotal(v), 0);
        const delta = pctDelta(revenue, lastRevenue);
        const yoyDelta = pctDelta(revenue, lastYearRevenue);
        const rr = await repeatRate(s.id, thisMonth.start, thisMonth.end);
        return {
          store: s,
          revenue,
          delta,
          yoyDelta,
          visitCount: visits.length,
          avgTicket: visits.length ? revenue / visits.length : 0,
          repeatRate: rr,
        };
      })
  );

  return (
    <>
      <Topbar title="集計・分析" scopeLabel={scopeLabel} roleLabel="オーナー全権限" />
      <div className="view">
        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">カテゴリ別売上構成比（今月・{scopeLabel}）</div>
            <div className="card-sub">施術メニューの内訳</div>
            <BarList
              bars={categoryBars.map((b) => ({ ...b, label: `${b.label} ${Math.round((b.value / categoryTotal) * 100)}%` }))}
              valueFormatter={yen}
            />
            {categoryBars.length === 0 && <div className="card-sub">今月の記録はまだありません。</div>}
          </div>

          <div className="card card-pad">
            <div className="card-title">顧客リピート率の推移</div>
            <div className="card-sub">{scopeLabel}・過去6ヶ月</div>
            <LineChart
              categories={monthLabels.map((m) => m.label)}
              series={[{ key: "repeat", label: "リピート率", color: "var(--accent)", values: repeatValues }]}
              unit="%"
              valueFormatter={(v) => v.toFixed(0)}
            />
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title">店舗別サマリー（前月比・前年同月比）</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>店舗</th>
                  <th>業態</th>
                  <th style={{ textAlign: "right" }}>今月売上</th>
                  <th style={{ textAlign: "right" }}>前月比</th>
                  <th style={{ textAlign: "right" }}>前年同月比</th>
                  <th style={{ textAlign: "right" }}>来店数</th>
                  <th style={{ textAlign: "right" }}>客単価</th>
                  <th style={{ textAlign: "right" }}>リピート率</th>
                </tr>
              </thead>
              <tbody>
                {storeSummaries.map((row) => (
                  <tr key={row.store.id}>
                    <td data-label="店舗">
                      <span className={`badge badge-store-${row.store.colorKey}`}>{row.store.name}</span>
                    </td>
                    <td data-label="業態">{row.store.kind === "LASH" ? "まつ毛エクステ専門" : "美容室"}</td>
                    <td data-label="今月売上" style={{ textAlign: "right" }}>
                      {yen(row.revenue)}
                    </td>
                    <td data-label="前月比" style={{ textAlign: "right" }}>
                      <span className={row.delta.dir === "down" ? "down" : "up"}>
                        {row.delta.dir === "down" ? "▼" : "▲"} {row.delta.pct.toFixed(1)}%
                      </span>
                    </td>
                    <td data-label="前年同月比" style={{ textAlign: "right" }}>
                      <span className={row.yoyDelta.dir === "down" ? "down" : "up"}>
                        {row.yoyDelta.dir === "down" ? "▼" : "▲"} {row.yoyDelta.pct.toFixed(1)}%
                      </span>
                    </td>
                    <td data-label="来店数" style={{ textAlign: "right" }}>
                      {row.visitCount}件
                    </td>
                    <td data-label="客単価" style={{ textAlign: "right" }}>
                      {yen(row.avgTicket)}
                    </td>
                    <td data-label="リピート率" style={{ textAlign: "right" }}>
                      {row.repeatRate.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
