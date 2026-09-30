import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/analytics";
import Topbar from "../Topbar";
import NewCollectionForm from "./NewCollectionForm";
import CollectionsTable from "./CollectionsTable";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };
const BASE_STORE_SLUG = "chura-re";

export default async function CashPage() {
  const session = await requireSession();
  if (!session) redirect("/");

  if (session.role !== "OWNER") {
    return (
      <>
        <Topbar title="現金管理" scopeLabel="-" roleLabel={session.role === "MANAGER" ? "マネージャー権限" : "スタッフ権限"} />
        <div className="view">
          <div className="card card-pad">
            <div className="card-title">閲覧権限がありません</div>
            <div className="card-sub">現金管理はオーナーのみが閲覧できます。</div>
          </div>
        </div>
      </>
    );
  }

  const [stores, cashVisitRows, expenseRows, collections] = await Promise.all([
    prisma.store.findMany({ where: { kind: { not: "VINTAGE" } }, orderBy: { createdAt: "asc" } }),
    prisma.visit.findMany({
      where: { paymentMethod: "cash" },
      select: { storeId: true, amount: true, productAmount: true },
    }),
    prisma.expense.findMany({ select: { storeId: true, amount: true } }),
    prisma.cashCollection.findMany({ include: { store: true }, orderBy: { date: "desc" } }),
  ]);

  const baseStore = stores.find((s) => s.slug === BASE_STORE_SLUG);
  const otherStores = stores.filter((s) => s.id !== baseStore?.id);

  const cashSalesByStore = new Map<string, number>();
  for (const v of cashVisitRows) {
    cashSalesByStore.set(v.storeId, (cashSalesByStore.get(v.storeId) ?? 0) + v.amount + (v.productAmount ?? 0));
  }
  const expenseByStore = new Map<string, number>();
  for (const e of expenseRows) {
    expenseByStore.set(e.storeId, (expenseByStore.get(e.storeId) ?? 0) + e.amount);
  }

  const baseCashSales = baseStore ? cashSalesByStore.get(baseStore.id) ?? 0 : 0;
  const baseExpense = baseStore ? expenseByStore.get(baseStore.id) ?? 0 : 0;
  const collectedTotal = collections.reduce((a, c) => a + c.amount, 0);
  const cashBalance = baseCashSales - baseExpense + collectedTotal;

  return (
    <>
      <Topbar title="現金管理" scopeLabel="全店舗" roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">現金残高（{baseStore?.name ?? "チュラ：re"}）</div>
            <div className="card-sub">現金売上（技術＋商品）− 経費 ＋ 他店舗からの回収額（累計）</div>
            <div className="kpi-value" style={{ fontSize: 32, marginTop: 8 }}>
              {yen(cashBalance)}
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="field">
                <div className="field-label">現金売上合計</div>
                <div className="field-value">{yen(baseCashSales)}</div>
              </div>
              <div className="field">
                <div className="field-label">経費合計</div>
                <div className="field-value">－{yen(baseExpense)}</div>
              </div>
              <div className="field">
                <div className="field-label">他店舗からの回収合計</div>
                <div className="field-value">＋{yen(collectedTotal)}</div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title">各店舗の現金売上・経費</div>
            <div className="card-sub">累計（全期間）</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>店舗</th>
                    <th style={{ textAlign: "right" }}>現金売上</th>
                    <th style={{ textAlign: "right" }}>経費</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.id}>
                      <td data-label="店舗">
                        {s.name}
                        {s.id === baseStore?.id ? "（集約先）" : ""}
                      </td>
                      <td data-label="現金売上" style={{ textAlign: "right" }}>
                        {yen(cashSalesByStore.get(s.id) ?? 0)}
                      </td>
                      <td data-label="経費" style={{ textAlign: "right" }}>
                        {yen(expenseByStore.get(s.id) ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <NewCollectionForm stores={otherStores.map((s) => ({ id: s.id, name: s.name }))} />

        <div className="card">
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <div className="card-title">回収履歴</div>
            <div className="card-sub">シェルバレー・リアンから運んだ現金の記録</div>
          </div>
          <CollectionsTable
            collections={collections}
            stores={otherStores.map((s) => ({ id: s.id, name: s.name }))}
          />
        </div>
      </div>
    </>
  );
}
