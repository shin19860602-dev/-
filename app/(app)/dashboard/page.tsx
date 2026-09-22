import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { dayBounds, monthBounds, yearToDateBounds, pctDelta, repeatRate, findVisits, yen, visitTotal, summarizeVisits } from "@/lib/analytics";
import { jstParts, jstDate } from "@/lib/date";
import Topbar from "../Topbar";
import LineChart from "../charts/LineChart";
import BarList from "../charts/BarList";
import ComparisonBars from "../charts/ComparisonBars";
import SummaryStats from "../SummaryStats";
import MonthSelect from "../MonthSelect";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };
const timeLabel = (d: Date) => {
  const p = jstParts(d);
  return `${String(p.hours).padStart(2, "0")}:${String(p.minutes).padStart(2, "0")}`;
};

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
    prisma.store.findMany({ where: { kind: { not: "VINTAGE" } }, orderBy: { createdAt: "asc" } }),
    prisma.visit.findMany({
      where: { storeId, date: { gte: sixMonthsAgo.start, lt: thisMonth.end } },
      select: { storeId: true, amount: true, productAmount: true, pointAmount: true, date: true },
    }),
    prisma.visit.findMany({
      where: { storeId, date: { gte: lastYearTrendStart, lt: lastYearTrendEnd } },
      select: { amount: true, productAmount: true, pointAmount: true, date: true },
    }),
    findVisits({ storeId, date: { gte: summaryMonth.start, lt: summaryMonth.end } }),
    findVisits({ storeId, date: { gte: summaryCompareMonth.start, lt: summaryCompareMonth.end } }),
  ]);

  const thisMonthExpenses = await prisma.expense.findMany({
    where: { storeId: storeId ?? undefined, date: { gte: thisMonth.start, lt: thisMonth.end } },
    select: { date: true, amount: true },
  });
  const thisMonthExpenseTotal = thisMonthExpenses.reduce((a, e) => a + e.amount, 0);

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

  // カテゴリ別売上構成比（売上登録時に選んだ分類ごと。店販は別項目として合算する）
  const categoryTotals = new Map<string, number>();
  let categoryProductTotal = 0;
  for (const v of thisMonthVisits) {
    const key = v.category || "未分類";
    categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + v.amount);
    categoryProductTotal += v.productAmount ?? 0;
  }
  if (categoryProductTotal > 0) categoryTotals.set("店販", categoryProductTotal);
  const categoryTotalSum = [...categoryTotals.values()].reduce((a, v) => a + v, 0) || 1;
  const categoryBars = [...categoryTotals.entries()]
    .map(([key, value]) => ({ key, label: key, color: "var(--accent)", value }))
    .sort((a, b) => b.value - a.value);

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
    monthLabels.push({ label: `${jstParts(b.start).month + 1}月`, start: b.start, end: b.end });
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

  // 日次売上推移（今月・曜日つき・前年同日比較）
  const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
  const dailyLabels: string[] = [];
  const dailyDateLabels: string[] = [];
  const dailyWeekday: string[] = [];
  const dailyThisYear: number[] = [];
  const dailyLastYear: number[] = [];
  const dailyVisitCount: number[] = [];
  const dailyExpense: number[] = [];
  for (let d = 1; d <= nowJst.date; d++) {
    const dayStart = jstDate(nowJst.year, nowJst.month, d);
    const dayEnd = jstDate(nowJst.year, nowJst.month, d + 1);
    const weekday = WEEKDAY_JA[jstParts(dayStart).day];
    dailyLabels.push(`${d}(${weekday})`);
    dailyDateLabels.push(`${nowJst.month + 1}/${d}`);
    dailyWeekday.push(weekday);
    const dayVisits = trendRows.filter((r) => r.date >= dayStart && r.date < dayEnd);
    dailyThisYear.push(dayVisits.reduce((a, r) => a + visitTotal(r), 0));
    dailyVisitCount.push(dayVisits.length);
    dailyExpense.push(thisMonthExpenses.filter((e) => e.date >= dayStart && e.date < dayEnd).reduce((a, e) => a + e.amount, 0));

    const lastYearDayStart = jstDate(nowJst.year - 1, nowJst.month, d);
    const lastYearDayEnd = jstDate(nowJst.year - 1, nowJst.month, d + 1);
    dailyLastYear.push(
      lastYearTrendRows.filter((r) => r.date >= lastYearDayStart && r.date < lastYearDayEnd).reduce((a, r) => a + visitTotal(r), 0)
    );
  }

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

          <div className="card card-pad">
            <div className="card-title">カテゴリ別売上構成比（今月・{scopeLabel}）</div>
            <div className="card-sub">売上登録時に選んだ分類の内訳</div>
            <BarList
              bars={categoryBars.map((b) => ({ ...b, label: `${b.label} ${Math.round((b.value / categoryTotalSum) * 100)}%` }))}
              valueFormatter={yen}
            />
            {categoryBars.length === 0 && <div className="card-sub">今月の記録はまだありません。</div>}
          </div>
        </div>

        {!storeId && (
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="card-title">今月の店舗別売上</div>
            <div className="card-sub">構成比</div>
            <BarList bars={storeBars} valueFormatter={yen} />
          </div>
        )}

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title">日次売上推移（前年比較）</div>
          <div className="card-sub">
            {scopeLabel}・{nowJst.year}年{nowJst.month + 1}月（曜日つき・去年の同日と比較）
          </div>
          <LineChart
            categories={dailyLabels}
            series={[
              { key: "this", label: `${nowJst.year}年`, color: "var(--accent)", values: dailyThisYear.map((v) => v / 10000) },
              { key: "last", label: `${nowJst.year - 1}年`, color: "var(--text-faint)", values: dailyLastYear.map((v) => v / 10000) },
            ]}
            unit="万円"
            valueFormatter={(v) => v.toFixed(0)}
          />
        </div>

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title">日別売上一覧</div>
          <div className="card-sub">
            {scopeLabel}・{nowJst.year}年{nowJst.month + 1}月（前年同日と比較）・経費合計 {yen(thisMonthExpenseTotal)}
          </div>
          <div className="table-wrap table-scroll">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th style={{ textAlign: "right" }}>売上</th>
                  <th style={{ textAlign: "right" }}>件数</th>
                  <th style={{ textAlign: "right" }}>経費</th>
                  <th style={{ textAlign: "right" }}>差引</th>
                  <th style={{ textAlign: "right" }}>前年同日</th>
                  <th style={{ textAlign: "right" }}>前年比</th>
                </tr>
              </thead>
              <tbody>
                {dailyDateLabels.map((label, i) => {
                  const delta = pctDelta(dailyThisYear[i], dailyLastYear[i]);
                  const net = dailyThisYear[i] - dailyExpense[i];
                  return (
                    <tr key={label}>
                      <td data-label="日付">
                        {label}（{dailyWeekday[i]}）
                      </td>
                      <td data-label="売上" style={{ textAlign: "right" }}>
                        {yen(dailyThisYear[i])}
                      </td>
                      <td data-label="件数" style={{ textAlign: "right" }}>
                        {dailyVisitCount[i]}件
                      </td>
                      <td data-label="経費" style={{ textAlign: "right" }}>
                        {yen(dailyExpense[i])}
                      </td>
                      <td data-label="差引" style={{ textAlign: "right" }}>
                        {yen(net)}
                      </td>
                      <td data-label="前年同日" style={{ textAlign: "right" }}>
                        {yen(dailyLastYear[i])}
                      </td>
                      <td data-label="前年比" style={{ textAlign: "right" }}>
                        <span className={`kpi-delta ${delta.dir === "down" ? "down" : "up"}`}>
                          {delta.dir === "down" ? "▼" : "▲"} {delta.pct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {dailyDateLabels.length === 0 && <div className="card-sub" style={{ padding: 20 }}>今月の記録はまだありません。</div>}
          </div>
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
            {scopeLabel}・{nowJst.year}年1月〜本日（対 去年同期間）
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
