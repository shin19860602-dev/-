import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { jstDate, jstParts } from "@/lib/date";
import { visitTotal, yen } from "@/lib/analytics";
import LineChart from "../charts/LineChart";

export default async function AnnualAnalytics({ year, storeId, scopeLabel, storeSlug }: {
  year: number; storeId?: string; scopeLabel: string; storeSlug?: string;
}) {
  const start = jstDate(year, 0, 1);
  const end = jstDate(year + 1, 0, 1);
  const stores = await prisma.store.findMany({
    where: { kind: { in: ["SALON", "LASH"] }, ...(storeId ? { id: storeId } : {}) },
    select: { id: true, name: true }, orderBy: { createdAt: "asc" },
  });
  const storeIds = stores.map(store => store.id);
  const [visits, expenses, previousVisits, previousExpenses] = await prisma.$transaction([
    prisma.visit.findMany({
      where: { storeId: { in: storeIds }, date: { gte: start, lt: end } },
      select: { date: true, storeId: true, customerId: true, amount: true, productAmount: true, pointAmount: true, paymentMethod: true, category: true },
    }),
    prisma.expense.findMany({
      where: { storeId: { in: storeIds }, date: { gte: start, lt: end } },
      select: { date: true, amount: true },
    }),
    prisma.visit.findMany({
      where: { storeId: { in: storeIds }, date: { gte: jstDate(year - 1, 0, 1), lt: start } },
      select: { date: true, customerId: true, amount: true, productAmount: true, pointAmount: true },
    }),
    prisma.expense.findMany({
      where: { storeId: { in: storeIds }, date: { gte: jstDate(year - 1, 0, 1), lt: start } },
      select: { amount: true },
    }),
  ], { isolationLevel: "RepeatableRead" });
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1, service: 0, product: 0, cash: 0, credit: 0, unknown: 0, points: 0, expense: 0, count: 0,
  }));
  const categories = new Map<string, number>();
  for (const visit of visits) {
    const row = months[jstParts(visit.date).month];
    const revenue = visit.amount + (visit.productAmount ?? 0);
    row.service += visit.amount;
    row.product += visit.productAmount ?? 0;
    row.points += visit.pointAmount ?? 0;
    row.count++;
    if (visit.paymentMethod === "cash") row.cash += revenue;
    else if (visit.paymentMethod === "credit") row.credit += revenue;
    else row.unknown += revenue;
    const category = visit.category || "未分類";
    categories.set(category, (categories.get(category) ?? 0) + visit.amount);
  }
  for (const expense of expenses) months[jstParts(expense.date).month].expense += expense.amount;
  const revenue = visits.reduce((sum, visit) => sum + visitTotal(visit), 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const customers = new Set(visits.map(visit => visit.customerId)).size;
  const previousRevenue = previousVisits.reduce((sum, visit) => sum + visitTotal(visit), 0);
  const previousExpense = previousExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const previousMonths = Array<number>(12).fill(0);
  for (const visit of previousVisits) previousMonths[jstParts(visit.date).month] += visitTotal(visit);
  const change = (current: number, previous: number) => previous === 0
    ? (current === 0 ? "—" : "比較不可（前年0）")
    : `${current - previous > 0 ? "+" : ""}${(((current - previous) / Math.abs(previous)) * 100).toFixed(1)}%`;
  const comparisons = [
    { label: "売上（ポイント含む）", current: revenue, previous: previousRevenue, format: yen },
    { label: "技術売上（ポイント除く）", current: visits.reduce((s, v) => s + v.amount, 0), previous: previousVisits.reduce((s, v) => s + v.amount, 0), format: yen },
    { label: "商品売上", current: visits.reduce((s, v) => s + (v.productAmount ?? 0), 0), previous: previousVisits.reduce((s, v) => s + (v.productAmount ?? 0), 0), format: yen },
    { label: "登録経費", current: expenseTotal, previous: previousExpense, format: yen },
    { label: "売上−登録経費", current: revenue - expenseTotal, previous: previousRevenue - previousExpense, format: yen },
    { label: "来店件数", current: visits.length, previous: previousVisits.length, format: (n: number) => `${n}件` },
    { label: "来店顧客実人数", current: customers, previous: new Set(previousVisits.map(v => v.customerId)).size, format: (n: number) => `${n}人` },
    { label: "来店1件あたり売上", current: visits.length ? revenue / visits.length : 0, previous: previousVisits.length ? previousRevenue / previousVisits.length : 0, format: yen },
  ];
  const total = (key: "service" | "product" | "cash" | "credit" | "unknown" | "points") => months.reduce((sum, row) => sum + row[key], 0);
  const cards = [
    ["年間売上（ポイント含む）", yen(revenue)], ["技術売上（ポイント除く）", yen(total("service"))], ["商品売上", yen(total("product"))],
    ["登録経費", yen(expenseTotal)], ["売上−登録経費", yen(revenue - expenseTotal)],
    ["来店件数", `${visits.length}件`], ["来店顧客実人数", `${customers}人`],
    ["来店1件あたり売上", yen(visits.length ? revenue / visits.length : 0)],
  ];
  return <>
    <div className="card card-pad">
      <div className="card-title">{year}年の年間まとめ ／ {scopeLabel}</div>
      <p className="card-sub">1月1日〜12月31日の登録データを集計しています。年の途中は登録済み分の累計です。来店件数と顧客実人数は別々に表示しています。</p>
      <div className="grid-2">{cards.map(([label, value]) => <div key={label} style={{ padding: "8px 0" }}><div className="card-sub">{label}</div><strong>{value}</strong></div>)}</div>
      <p className="card-sub">売上合計は既存の月別分析と同じく「登録技術売上＋商品売上＋ポイント」です。現金・カードにはポイントを含めません。「売上−登録経費」は登録額の差額で、給与・在庫・減価償却等を含む最終利益は会計帳簿で確認します。</p>
    </div>
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="card-title">前年との年間比較</div>
      <p className="card-sub">同じ店舗範囲の1月〜12月を比較します。今年が年の途中の場合も、前年は1年分です。記録がない期間も0として表示するため、未登録と売上ゼロは区別できません。前年比は前年の絶対値を基準とし、前年0の場合は算出しません。</p>
      <div className="table-wrap"><table><thead><tr><th>項目</th><th>{year}年</th><th>{year - 1}年</th><th>前年差</th><th>前年比</th></tr></thead><tbody>{comparisons.map(item => <tr key={item.label}>
        <td data-label="項目">{item.label}</td><td data-label={`${year}年`}>{item.format(item.current)}</td><td data-label={`${year - 1}年`}>{item.format(item.previous)}</td><td data-label="前年差">{item.current > item.previous ? "+" : ""}{item.format(item.current - item.previous)}</td><td data-label="前年比">{change(item.current, item.previous)}</td>
      </tr>)}</tbody></table></div>
    </div>
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="card-title">月別売上の推移</div>
      <LineChart categories={months.map(row => `${row.month}月`)} series={[
        { key: "sales", label: "売上（ポイント含む）", color: "var(--accent)", values: months.map(row => row.service + row.product + row.points) },
        { key: "previous", label: `${year - 1}年の売上`, color: "var(--text-dim)", values: previousMonths },
      ]} unit="円" valueFormatter={yen} />
    </div>
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="card-title">月ごとの前年同月比較</div>
      <div className="table-wrap"><table><thead><tr><th>月</th><th>{year}年の売上</th><th>{year - 1}年の売上</th><th>前年差</th><th>前年同月比</th></tr></thead><tbody>{months.map((row, index) => {
        const current = row.service + row.product + row.points;
        const previous = previousMonths[index];
        return <tr key={row.month}><td data-label="月">{row.month}月</td><td data-label={`${year}年の売上`}>{yen(current)}</td><td data-label={`${year - 1}年の売上`}>{yen(previous)}</td><td data-label="前年差">{current > previous ? "+" : ""}{yen(current - previous)}</td><td data-label="前年同月比">{change(current, previous)}</td></tr>;
      })}</tbody></table></div>
    </div>
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="card-title">1月〜12月の内訳</div>
      <div className="table-wrap"><table><thead><tr>{["月", "技術売上", "商品売上", "売上合計", "現金（商品含む）", "カード（商品含む）", "支払方法未登録", "ポイント", "登録経費", "来店件数", "来店単価"].map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{months.map(row => {
          const query = new URLSearchParams({ month: `${year}-${String(row.month).padStart(2, "0")}` });
          if (storeSlug) query.set("store", storeSlug);
          const sales = row.service + row.product + row.points;
          return <tr key={row.month}><td data-label="月"><Link href={`/analytics?${query}`}>{row.month}月</Link></td>{[
            ["技術売上", yen(row.service)], ["商品売上", yen(row.product)], ["売上合計", yen(sales)],
            ["現金（商品含む）", yen(row.cash)], ["カード（商品含む）", yen(row.credit)], ["支払方法未登録", yen(row.unknown)],
            ["ポイント", yen(row.points)], ["登録経費", yen(row.expense)], ["来店件数", `${row.count}件`],
            ["来店単価", yen(row.count ? sales / row.count : 0)],
          ].map(([label, value]) => <td key={label} data-label={label}>{value}</td>)}</tr>;
        })}</tbody>
        <tfoot><tr><th>年間合計</th>{[yen(total("service")), yen(total("product")), yen(revenue), yen(total("cash")), yen(total("credit")), yen(total("unknown")), yen(total("points")), yen(expenseTotal), `${visits.length}件`, yen(visits.length ? revenue / visits.length : 0)].map((value, index) => <td key={index}>{value}</td>)}</tr></tfoot>
      </table></div>
    </div>
    <div className="grid-2" style={{ marginTop: 16 }}>
      <div className="card card-pad"><div className="card-title">店舗別の年間売上</div>{stores.map(store => {
        const own = visits.filter(visit => visit.storeId === store.id);
        return <p key={store.id}>{store.name}　<strong>{yen(own.reduce((sum, visit) => sum + visitTotal(visit), 0))}</strong> ／ {own.length}件</p>;
      })}</div>
      <div className="card card-pad"><div className="card-title">技術カテゴリ別の年間売上</div>{[...categories].sort((a, b) => b[1] - a[1]).map(([label, value]) => <p key={label}>{label}　<strong>{yen(value)}</strong></p>)}{!categories.size && <p>この年の記録はまだありません。</p>}</div>
    </div>
  </>;
}
