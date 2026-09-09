import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { dayBounds, monthBounds, sameDayBounds, findVisits, yen, visitTotal, pctDelta } from "@/lib/analytics";
import Topbar from "../Topbar";
import SalesFilters from "./SalesFilters";
import NewSaleForm from "./NewSaleForm";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };
const BADGE_CLASS: Record<string, string> = { a: "badge-store-a", b: "badge-store-b", c: "badge-store-c" };
const GENDER_LABEL: Record<string, string> = { male: "男性", female: "女性", other: "その他" };
const PAYMENT_LABEL: Record<string, string> = { cash: "現金", credit: "クレジット" };
const dateLabel = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const timeLabel = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function genderBreakdown(visits: { customer: { id: string; gender: string | null } }[]) {
  const seen = new Map<string, string | null>();
  for (const v of visits) seen.set(v.customer.id, v.customer.gender);
  const counts = new Map<string, number>();
  for (const gender of seen.values()) {
    const key = gender ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { customerCount: seen.size, counts };
}

function periodBounds(period: string, now: Date) {
  if (period === "today") return dayBounds(now, 0);
  if (period === "week") {
    const end = dayBounds(now, 1).start;
    const start = dayBounds(now, -6).start;
    return { start, end };
  }
  if (period === "lastmonth") return monthBounds(now, -1);
  return monthBounds(now, 0);
}

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; period?: string; staff?: string }>;
}) {
  const session = await requireSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";
  const period = sp.period ?? "month";
  const { start, end } = periodBounds(period, new Date());

  const today = dayBounds(new Date(), 0);
  const lastYearToday = sameDayBounds(new Date(), -1);

  const [visits, allStores, allStaff, allCustomers, todayVisits, lastYearTodayVisits, allMenuItems] = await Promise.all([
    findVisits({ storeId, staffId: sp.staff || undefined, date: { gte: start, lt: end } }),
    prisma.store.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.staff.findMany({ where: { storeId: storeId ?? undefined, active: true, role: { not: "OWNER" } }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: { storeId: storeId ?? undefined, active: true }, orderBy: { name: "asc" } }),
    findVisits({ storeId, date: { gte: today.start, lt: today.end } }),
    findVisits({ storeId, date: { gte: lastYearToday.start, lt: lastYearToday.end } }),
    prisma.menuItem.findMany({ where: { storeId: storeId ?? undefined, active: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const serviceMenus = allMenuItems.filter((m) => m.type === "service");
  const productMenus = allMenuItems.filter((m) => m.type === "product");

  const staffOptions = allStaff.map((s) => ({ id: s.id, name: s.name }));
  const totalAmount = visits.reduce((a, v) => a + visitTotal(v), 0);
  const todayTotal = todayVisits.reduce((a, v) => a + visitTotal(v), 0);
  const todayServiceTotal = todayVisits.reduce((a, v) => a + v.amount, 0);
  const todayProductTotal = todayVisits.reduce((a, v) => a + (v.productAmount ?? 0), 0);
  const todayPointTotal = todayVisits.reduce((a, v) => a + (v.pointAmount ?? 0), 0);
  const { customerCount: todayCustomerCount, counts: todayGenderCounts } = genderBreakdown(todayVisits);
  const lastYearTodayTotal = lastYearTodayVisits.reduce((a, v) => a + visitTotal(v), 0);
  const yoyTodayDelta = pctDelta(todayTotal, lastYearTodayTotal);
  const lastYearDateLabel = `${lastYearToday.start.getFullYear()}/${String(lastYearToday.start.getMonth() + 1).padStart(2, "0")}/${String(lastYearToday.start.getDate()).padStart(2, "0")}`;

  return (
    <>
      <Topbar title="売上" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <NewSaleForm
          isOwner={session.role === "OWNER"}
          fixedStoreId={storeId}
          stores={allStores.map((s) => ({ id: s.id, name: s.name, colorKey: s.colorKey }))}
          customers={allCustomers.map((c) => ({ id: c.id, name: c.name, storeId: c.storeId }))}
          serviceMenus={serviceMenus}
          productMenus={productMenus}
        />

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title">本日のまとめ</div>
          <div className="card-sub">{scopeLabel}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <div className="field">
              <div className="field-label">客数</div>
              <div className="field-value">
                {todayCustomerCount}名
                {todayGenderCounts.size > 0 && (
                  <span style={{ fontWeight: 400, color: "var(--text-dim)", fontSize: 12 }}>
                    {" "}
                    （
                    {[...todayGenderCounts.entries()]
                      .map(([g, c]) => `${GENDER_LABEL[g] ?? "不明"} ${c}`)
                      .join("・")}
                    ）
                  </span>
                )}
              </div>
            </div>
            <div className="field">
              <div className="field-label">技術売上合計</div>
              <div className="field-value">{yen(todayServiceTotal)}</div>
            </div>
            <div className="field">
              <div className="field-label">商品売上合計</div>
              <div className="field-value">{yen(todayProductTotal)}</div>
            </div>
            <div className="field">
              <div className="field-label">ポイント売上合計</div>
              <div className="field-value">{yen(todayPointTotal)}</div>
            </div>
          </div>

          <div className="card-sub" style={{ marginTop: 10 }}>
            合計 <strong style={{ color: "var(--text)" }}>{yen(todayTotal)}</strong>（{todayVisits.length}件）
            <span style={{ marginLeft: 10 }}>
              去年の同じ日（{lastYearDateLabel}）は {yen(lastYearTodayTotal)}
              {lastYearTodayTotal > 0 && (
                <span className={yoyTodayDelta.dir === "down" ? "down" : "up"} style={{ marginLeft: 6 }}>
                  {yoyTodayDelta.dir === "down" ? "▼" : "▲"} {yoyTodayDelta.pct.toFixed(1)}%
                </span>
              )}
            </span>
          </div>

          {todayVisits.length === 0 ? (
            <div className="card-sub">本日の登録はまだありません。</div>
          ) : (
            <div>
              {todayVisits.map((v) => (
                <div className="list-row" key={v.id}>
                  <div className="grow">
                    <div className="title">
                      {v.customer.name} 様・{v.menuName}
                      {v.productName ? `＋店販：${v.productName}` : ""}
                      {v.pointAmount ? `＋ポイント${yen(v.pointAmount)}` : ""}
                    </div>
                    <div className="meta">
                      {timeLabel(v.date)}・担当 {v.staff.name}
                      {v.paymentMethod ? `・${PAYMENT_LABEL[v.paymentMethod] ?? v.paymentMethod}` : ""}
                      {v.memo ? `・${v.memo}` : ""}
                    </div>
                  </div>
                  <div className="amount">{yen(visitTotal(v))}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="filters">
          <SalesFilters staffOptions={staffOptions} />
          <div style={{ flex: 1 }} />
          <span className="card-sub" style={{ margin: 0 }}>
            合計 <strong style={{ color: "var(--text)" }}>{yen(totalAmount)}</strong>（{visits.length}件）
          </span>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>店舗</th>
                  <th>担当スタッフ</th>
                  <th>お客様</th>
                  <th>施術内容</th>
                  <th>お支払い</th>
                  <th style={{ textAlign: "right" }}>金額</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td data-label="日付">{dateLabel(v.date)}</td>
                    <td data-label="店舗">
                      <span className={`badge ${BADGE_CLASS[v.store.colorKey]}`}>{v.store.name}</span>
                    </td>
                    <td data-label="担当">{v.staff.name}</td>
                    <td data-label="お客様">{v.customer.name} 様</td>
                    <td data-label="施術内容">
                      {v.menuName}
                      {v.productName && <span className="card-sub" style={{ margin: 0 }}>＋店販：{v.productName}</span>}
                      {v.pointAmount ? <span className="card-sub" style={{ margin: 0 }}>＋ポイント{yen(v.pointAmount)}</span> : null}
                    </td>
                    <td data-label="お支払い">{v.paymentMethod ? PAYMENT_LABEL[v.paymentMethod] ?? v.paymentMethod : "-"}</td>
                    <td data-label="金額" style={{ textAlign: "right" }}>
                      {yen(visitTotal(v))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visits.length === 0 && (
              <div className="card-sub" style={{ padding: 20 }}>
                この条件に一致する売上はまだありません。
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
