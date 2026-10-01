import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { monthBounds, pctDelta, repeatRate, yen, visitTotal } from "@/lib/analytics";
import { jstParts, jstDate } from "@/lib/date";
import Topbar from "../Topbar";
import LineChart from "../charts/LineChart";
import BarList from "../charts/BarList";
import MonthSelect from "../MonthSelect";

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ store?: string; month?: string }> }) {
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

  // 過去の任意の月を選んで見られるようにする（データが無い月まで遡らない）
  const earliestVisit = await prisma.visit.aggregate({ where: { storeId: storeId ?? undefined }, _min: { date: true } });
  const earliestDate = earliestVisit._min.date ?? now;
  const nowJst = jstParts(now);
  const earliestJst = jstParts(earliestDate);
  const monthOptions: { value: string; label: string }[] = [];
  {
    let y = nowJst.year;
    let m = nowJst.month;
    const endY = earliestJst.year;
    const endM = earliestJst.month;
    while (y > endY || (y === endY && m >= endM)) {
      monthOptions.push({ value: `${y}-${String(m + 1).padStart(2, "0")}`, label: `${y}年${m + 1}月` });
      m -= 1;
      if (m < 0) {
        m = 11;
        y -= 1;
      }
    }
  }
  const defaultMonthValue = `${nowJst.year}-${String(nowJst.month + 1).padStart(2, "0")}`;
  const selectedMonthValue = sp.month && monthOptions.some((o) => o.value === sp.month) ? sp.month : defaultMonthValue;
  const [selYear, selMonth] = selectedMonthValue.split("-").map(Number);
  const selectedBase = jstDate(selYear, selMonth - 1, 1);

  const thisMonth = monthBounds(selectedBase, 0);
  const lastMonth = monthBounds(selectedBase, -1);
  const sixMonthsAgo = monthBounds(selectedBase, -5);
  const lastYearSameMonth = monthBounds(selectedBase, -12);

  const [thisMonthVisits, allStores, lastMonthByStore, lastYearByStore] = await Promise.all([
    prisma.visit.findMany({
      where: { storeId: storeId ?? undefined, date: { gte: thisMonth.start, lt: thisMonth.end } },
      select: { menuName: true, category: true, amount: true, productAmount: true, pointAmount: true, storeId: true },
    }),
    prisma.store.findMany({ where: { kind: { not: "VINTAGE" } }, orderBy: { createdAt: "asc" } }),
    prisma.visit.findMany({
      where: { storeId: storeId ?? undefined, date: { gte: lastMonth.start, lt: lastMonth.end } },
      select: { amount: true, productAmount: true, pointAmount: true, storeId: true },
    }),
    prisma.visit.findMany({
      where: { storeId: storeId ?? undefined, date: { gte: lastYearSameMonth.start, lt: lastYearSameMonth.end } },
      select: { amount: true, productAmount: true, pointAmount: true, storeId: true },
    }),
  ]);

  // カテゴリ別売上構成比（売上登録時に選んだ分類ごと。店販は別項目として合算する。ポイントは売上区分であってカテゴリではないため含めない）
  const categoryTotals = new Map<string, number>();
  let productTotal = 0;
  for (const v of thisMonthVisits) {
    const key = v.category || "未分類";
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + v.amount);
    productTotal += v.productAmount ?? 0;
  }
  if (productTotal > 0) categoryTotals.set("店販", productTotal);
  const categoryTotal = [...categoryTotals.values()].reduce((a, v) => a + v, 0) || 1;
  const categoryBars = [...categoryTotals.entries()]
    .map(([key, value]) => ({ key, label: key, color: "var(--accent)", value }))
    .sort((a, b) => b.value - a.value);

  // リピート率推移（選択した月までの6ヶ月）
  const monthLabels: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const b = monthBounds(selectedBase, -i);
    monthLabels.push({ label: `${jstParts(b.start).month + 1}月`, start: b.start, end: b.end });
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
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="card-title">表示する月</div>
              <div className="card-sub" style={{ margin: 0 }}>
                {selYear}年{selMonth}月を表示中（過去の月も選べます）
              </div>
            </div>
            <MonthSelect options={monthOptions} current={selectedMonthValue} />
          </div>
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">
              カテゴリ別売上構成比（{selYear}年{selMonth}月・{scopeLabel}）
            </div>
            <div className="card-sub">施術メニューの内訳</div>
            <BarList
              bars={categoryBars.map((b) => ({ ...b, label: `${b.label} ${Math.round((b.value / categoryTotal) * 100)}%` }))}
              valueFormatter={yen}
            />
            {categoryBars.length === 0 && <div className="card-sub">この月の記録はまだありません。</div>}
          </div>

          <div className="card card-pad">
            <div className="card-title">顧客リピート率の推移</div>
            <div className="card-sub">
              {scopeLabel}・{selYear}年{selMonth}月までの過去6ヶ月
            </div>
            <LineChart
              categories={monthLabels.map((m) => m.label)}
              series={[{ key: "repeat", label: "リピート率", color: "var(--accent)", values: repeatValues }]}
              unit="%"
              valueFormatter={(v) => v.toFixed(0)}
            />
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title">
            店舗別サマリー（{selYear}年{selMonth}月・前月比・前年同月比）
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>店舗</th>
                  <th>業態</th>
                  <th style={{ textAlign: "right" }}>売上</th>
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
                    <td data-label="売上" style={{ textAlign: "right" }}>
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
