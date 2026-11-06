import { prisma } from "@/lib/prisma";
import { jstDate, jstParts } from "@/lib/date";
import { yen } from "@/lib/analytics";
import { dailyEncouragement, monthlyGoal, encouragements } from "@/lib/monthlyGoals";

export default async function MonthlyGoalBanner({ storeId }: { storeId?: string }) {
  const now = new Date();
  const p = jstParts(now);
  const stores = await prisma.store.findMany({
    where: { kind: { in: ["SALON", "LASH"] }, ...(storeId ? { id: storeId } : {}) },
    select: { id: true, name: true }, orderBy: { createdAt: "asc" },
  });
  const previous = await prisma.visit.groupBy({
    by: ["storeId"],
    where: { storeId: { in: stores.map(store => store.id) }, date: { gte: jstDate(p.year - 1, p.month, 1), lt: jstDate(p.year - 1, p.month + 1, 1) } },
    _sum: { amount: true, productAmount: true }, _count: { _all: true },
  });
  return <section aria-label="今月の店舗別目標" className="card card-pad" style={{ marginBottom: 20, border: "2px solid var(--accent)", background: "var(--surface)" }}>
    <h2 style={{ fontSize: 26, margin: "0 0 8px", color: "var(--accent)" }}>今月の目標！！</h2>
    <p className="card-sub">{p.year}年{p.month + 1}月 ／ 前年同月の売上から5％アップ</p>
    <div className="grid-2">{stores.map(store => {
      const base = previous.find(row => row.storeId === store.id);
      return <div key={store.id} style={{ padding: "12px 0", minWidth: 0 }}>
        <h3 style={{ margin: "0 0 8px", overflowWrap: "anywhere" }}>{store.name}</h3>
        {base && base._count._all > 0 ? <>
          <p style={{ fontSize: 21, margin: "8px 0" }}>技術売上　<strong>{yen(monthlyGoal(base._sum.amount ?? 0))}</strong></p>
          <p style={{ fontSize: 21, margin: "8px 0" }}>店販売上　<strong>{yen(monthlyGoal(base._sum.productAmount ?? 0))}</strong></p>
        </> : <p>前年同月の売上記録がないため、目標はまだ計算できません。</p>}
        <p style={{ fontWeight: 600, lineHeight: 1.8, overflowWrap: "anywhere" }}>🌺 今日の応援メッセージ<br />{dailyEncouragement(now, store.id)}</p>
      </div>;
    })}</div>
    <p className="card-sub">技術売上は登録済みの技術料金（ポイント差引後）、店販売上は商品売上が基準です。1円未満は切り上げます。応援コメントは{encouragements.length}種類を店舗ごとにランダムな順番で表示し、毎日午前0時（日本時間）に切り替わります。</p>
  </section>;
}
