import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { dayBounds, monthBounds, yearToDateBounds, pctDelta, repeatRate, findVisits, yen, visitTotal, summarizeVisits } from "@/lib/analytics";
import Topbar from "../Topbar";
import LineChart from "../charts/LineChart";
import BarList from "../charts/BarList";
import ComparisonBars from "../charts/ComparisonBars";
import SummaryStats from "../SummaryStats";
import MonthSelect from "../MonthSelect";

import { givenNameInitial as initial } from "@/lib/format";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };
const timeLabel = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ store?: string; month?: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";

  const now = new Date();
  const today = dayBounds(now, 0);
  const yesterday = dayBounds(now, -1);
  const thisMonth = monthBounds(now, 0);
  const lastMonth = monthBounds(now, -1);
  const sixMonthsAgo = monthBounds(now, -5);
  const lastYearSameMonth = monthBounds(now, -12);
  const yearToDate = yearToDateBounds(now, 0);
  const lastYearToDate = yearToDateBounds(now, -1);

  // 月次まとめ：過去の任意の月を選んで見られるようにする（データが無い月まで遡らない）
  const earliestVisit = await prisma.visit.aggregate({ where: { storeId: storeId ?? undefined }, _min: { date: true } });
  const earliestDate = earliestVisit._min.date ?? now;
  const monthOptions: { value: string; label: string }[] = [];
  {
    let y = now.getFullYear();
    let m = now.getMonth();
    const endY = earliestDate.getFullYear();
    const endM = earliestDate.getMonth();
    while (y > endY || (y === endY && m >= endM)) {
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
  const selectedBase = new Date(selYear, selMonth - 1, 1);
  const summaryMonth = monthBounds(selectedBase, 0);
  const summaryCompareMonth = monthBounds(selectedBase, -12);

  const lastYearTrendStart = monthBounds(now, -17).start;
  const lastYearTrendEnd = monthBounds(now, -12).end;

  const [
    todayVisits,
    yesterdayVisits,
    thisMonthVisits,
    lastMonthVisits,
    thisYearVisits,
    lastYearToDateVisits,
    repeatThis,
    repeatLast,
    allStores,
    trendRows,
    lastYearTrendRows,
    summaryMonthVisits,
    summaryCompareVisits,
  ] = await Promise.all([
    findVisits({ storeId, date: { gte: today.start, lt: today.end } }),
    findVisits({ storeId, date: { gte: yesterday.start, lt: yesterday.end } }),
    findVisits({ storeId, date: { gte: thisMonth.start, lt: thisMonth.end } }),
    findVisits({ storeId, date: { gte: lastMonth.start, lt: lastMonth.end } }),
    findVisits({ storeId, date: { gte: yearToDate.start, lt: yearToDate.end } }),
    findVisits({ storeId, date: { gte: lastYearToDate.start, lt: lastYearToDate.end } }),
    repeatRate(storeId, thisMonth.start, thisMonth.end),
    repeatRate(storeId, lastMonth.start, lastMonth.end),
    prisma.store.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.visit.findMany({
      where: { storeId, date: { gte: sixMonthsAgo.start, lt: thisMonth.end } },
      select: { storeId: true, amount: true, productAmount: true, pointAmount: true, date: true },
    }),
    prisma.visit.findMany({
      where: { storeId, date: { gte: lastYearTrendStart, lt: lastYearTrendEnd } },
      select: { amount: true, productAmount: true, date: true },
    }),
    findVisits({ storeId, date: { gte: summaryMonth.start, lt: summaryMonth.end } }),
    findVisits({ storeId, date: { gte: summaryCompareMonth.start, lt: summaryCompareMonth.end } }),
  ]);

  const monthSummary = summarizeVisits(summaryMonthVisits);
  const monthCompareSummary = summarizeVisits(summaryCompareVisits);
  const yearSummary = summarizeVisits(thisYearVisits);
  const yearCompareSummary = summarizeVisits(lastYearToDateVisits);

  const sum = (rows: { amount: number; productAmount?: number | null }[]) => rows.reduce((a, v) => a + visitTotal(v), 0);
  const todayRevenue = sum(todayVisits);
  const yesterdayRevenue = sum(yesterdayVisits);
  const monthRevenue = sum(thisMonthVisits);
  const lastMonthRevenue = sum(lastMonthVisits);

  const todayDelta = pctDelta(todayRevenue, yesterdayRevenue);
  const monthDelta = pctDelta(monthRevenue, lastMonthRevenue);
  const visitsDelta = pctDelta(thisMonthVisits.length, lastMonthVisits.length);
  const repeatDeltaPt = repeatThis - repeatLast;

  // 店舗別 今月売上（全店舗表示のときのみ）
  const storeBars = !storeId
    ? allStores.map((s) => ({
        key: s.id,
        label: s.name,
        color: `var(--store-${s.colorKey})`,
        value: thisMonthVisits.filter((v) => v.storeId === s.id).reduce((a, v) => a + visitTotal(v), 0),
      }))
    : [];

  // 月次売上推移（過去6ヶ月・万円）
  const monthLabels: { label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const b = monthBounds(now, -i);
    monthLabels.push({ label: `${b.start.getMonth() + 1}月`, start: b.start, end: b.end });
  }
  const trendTargets = storeId ? allStores.filter((s) => s.id === storeId) : allStores;
  const trendSeries = trendTargets.map((s) => ({
    key: s.id,
    label: s.name,
    color: `var(--store-${s.colorKey})`,
    values: monthLabels.map(
      (m) => trendRows.filter((r) => r.storeId === s.id && r.date >= m.start && r.date < m.end).reduce((a, r) => a + visitTotal(r), 0) / 10000
    ),
  }));

  // 月次売上推移の前年比較（技術・商品を分けて、過去6ヶ月それぞれ去年同月と比べる）
  const monthOffsets = [5, 4, 3, 2, 1, 0];
  const serviceThisYearByMonth = monthLabels.map((m) =>
    trendRows.filter((r) => r.date >= m.start && r.date < m.end).reduce((a, r) => a + r.amount, 0)
  );
  const productThisYearByMonth = monthLabels.map((m) =>
    trendRows.filter((r) => r.date >= m.start && r.date < m.end).reduce((a, r) => a + (r.productAmount ?? 0), 0)
  );
  const serviceLastYearByMonth = monthOffsets.map((off) => {
    const b = monthBounds(now, -off - 12);
    return lastYearTrendRows.filter((r) => r.date >= b.start && r.date < b.end).reduce((a, r) => a + r.amount, 0);
  });
  const productLastYearByMonth = monthOffsets.map((off) => {
    const b = monthBounds(now, -off - 12);
    return lastYearTrendRows.filter((r) => r.date >= b.start && r.date < b.end).reduce((a, r) => a + (r.productAmount ?? 0), 0);
  });

  // スタッフ売上ランキング（今月）
  const staffTotals = new Map<string, { name: string; title: string | null; colorKey: string; total: number }>();
  for (const v of thisMonthVisits) {
    const key = v.staffId;
    const entry = staffTotals.get(key) ?? { name: v.staff.name, title: v.staff.title, colorKey: v.staff.store?.colorKey ?? "a", total: 0 };
    entry.total += visitTotal(v);
    staffTotals.set(key, entry);
  }
  const staffRanking = [...staffTotals.values()].sort((a, b) => b.total - a.total).slice(0, 4);

  const recentUpdates = thisMonthVisits.slice(0, 4);

  return (
    <>
      <Topbar title="ダッシュボード" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <div className="kpi-row">
          <div className="card kpi">
            <div className="kpi-label">本日の売上{!storeId ? "（全店）" : ""}</div>
            <div className="kpi-value">{yen(todayRevenue)}</div>
            <span className={`kpi-delta ${todayDelta.dir === "down" ? "down" : "up"}`}>
              {todayDelta.dir === "down" ? "▼" : "▲"} {todayDelta.pct.toFixed(1)}% 前日比
            </span>
          </div>
          <div className="card kpi">
            <div className="kpi-label">今月の売上{!storeId ? "（全店）" : ""}</div>
            <div className="kpi-value">{yen(monthRevenue)}</div>
            <span className={`kpi-delta ${monthDelta.dir === "down" ? "down" : "up"}`}>
              {monthDelta.dir === "down" ? "▼" : "▲"} {monthDelta.pct.toFixed(1)}% 前月比
            </span>
          </div>
          <div className="card kpi">
            <div className="kpi-label">今月の来店数</div>
            <div className="kpi-value">
              {thisMonthVisits.length}
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dim)" }}>件</span>
            </div>
            <span className={`kpi-delta ${visitsDelta.dir === "down" ? "down" : "up"}`}>
              {visitsDelta.dir === "down" ? "▼" : "▲"} {visitsDelta.pct.toFixed(1)}% 前月比
            </span>
          </div>
          <div className="card kpi">
            <div className="kpi-label">顧客リピート率</div>
            <div className="kpi-value">
              {repeatThis.toFixed(1)}
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dim)" }}>%</span>
            </div>
            <span className={`kpi-delta ${repeatDeltaPt < 0 ? "down" : "up"}`}>
              {repeatDeltaPt < 0 ? "▼" : "▲"} {Math.abs(repeatDeltaPt).toFixed(1)}pt 前月比
            </span>
          </div>
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">月次売上推移（{storeId ? scopeLabel : "店舗別"}・過去6ヶ月）</div>
            <div className="card-sub">単位：万円</div>
            <LineChart
              categories={monthLabels.map((m) => m.label)}
              series={trendSeries}
              unit="万円"
              valueFormatter={(v) => v.toFixed(0)}
            />
          </div>

          {!storeId ? (
            <div className="card card-pad">
              <div className="card-title">今月の店舗別売上</div>
              <div className="card-sub">構成比</div>
              <BarList bars={storeBars} valueFormatter={yen} />
            </div>
          ) : (
            <div className="card card-pad">
              <div className="card-title">スタッフ売上ランキング（今月）</div>
              <div className="card-sub">{store?.name}</div>
              <StaffRankingList staffRanking={staffRanking} />
            </div>
          )}
        </div>

        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">月次売上推移（前年比較・技術売上）</div>
            <div className="card-sub">{scopeLabel}・過去6ヶ月</div>
            <ComparisonBars
              categories={monthLabels.map((m) => m.label)}
              current={serviceThisYearByMonth}
              previous={serviceLastYearByMonth}
              currentLabel="今年"
              previousLabel="去年"
              valueFormatter={yen}
            />
          </div>
          <div className="card card-pad">
            <div className="card-title">月次売上推移（前年比較・商品売上）</div>
            <div className="card-sub">{scopeLabel}・過去6ヶ月</div>
            <ComparisonBars
              categories={monthLabels.map((m) => m.label)}
              current={productThisYearByMonth}
              previous={productLastYearByMonth}
              currentLabel="今年"
              previousLabel="去年"
              valueFormatter={yen}
            />
          </div>
        </div>

        <div className="grid-2">
          {!storeId && (
            <div className="card card-pad">
              <div className="card-title">スタッフ売上ランキング（今月）</div>
              <div className="card-sub">全店舗合算</div>
              <StaffRankingList staffRanking={staffRanking} />
            </div>
          )}

          <div className="card card-pad">
            <div className="card-title">最近のカルテ更新</div>
            <div className="card-sub">直近の来店・記録</div>
            {recentUpdates.length === 0 && <div className="card-sub">今月の記録はまだありません。</div>}
            {recentUpdates.map((v) => (
              <div className="list-row" key={v.id}>
                <div className="grow">
                  <div className="title">{v.customer.name} 様</div>
                  <div className="meta">
                    {v.menuName}
                    {v.productName ? `＋店販：${v.productName}` : ""}・担当 {v.staff.name}（{v.store.name}）
                  </div>
                </div>
                <div className="meta">{timeLabel(v.date)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div className="card-title">月次まとめ</div>
              <div className="card-sub">
                {scopeLabel}・{selYear}年{selMonth}月（対 去年同月）
              </div>
            </div>
            <MonthSelect options={monthOptions} current={selectedMonthValue} />
          </div>
          <SummaryStats summary={monthSummary} compare={monthCompareSummary} />
          <div style={{ marginTop: 16 }}>
            <ComparisonBars
              categories={["技術売上", "商品売上", "合計"]}
              current={[monthSummary.serviceTotal, monthSummary.productTotal, monthSummary.total]}
              previous={[monthCompareSummary.serviceTotal, monthCompareSummary.productTotal, monthCompareSummary.total]}
              currentLabel={`${selYear}年${selMonth}月`}
              previousLabel="去年同月"
              valueFormatter={yen}
            />
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title">年間まとめ</div>
          <div className="card-sub">
            {scopeLabel}・{yearToDate.start.getFullYear()}年1月〜本日（対 去年同期間）
          </div>
          <SummaryStats summary={yearSummary} compare={yearCompareSummary} />
          <div style={{ marginTop: 16 }}>
            <ComparisonBars
              categories={["技術売上", "商品売上", "合計"]}
              current={[yearSummary.serviceTotal, yearSummary.productTotal, yearSummary.total]}
              previous={[yearCompareSummary.serviceTotal, yearCompareSummary.productTotal, yearCompareSummary.total]}
              currentLabel="今年"
              previousLabel="去年同期間"
              valueFormatter={yen}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function StaffRankingList({ staffRanking }: { staffRanking: { name: string; title: string | null; colorKey: string; total: number }[] }) {
  if (staffRanking.length === 0) return <div className="card-sub">今月の記録はまだありません。</div>;
  return (
    <div>
      {staffRanking.map((s) => (
        <div className="list-row" key={s.name}>
          <div className="mini-avatar" style={{ background: `var(--store-${s.colorKey})` }}>
            {initial(s.name)}
          </div>
          <div className="grow">
            <div className="title">{s.name}</div>
            <div className="meta">{s.title}</div>
          </div>
          <div className="amount">{yen(s.total)}</div>
        </div>
      ))}
    </div>
  );
}
