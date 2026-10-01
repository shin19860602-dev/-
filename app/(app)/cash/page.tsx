import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { yen } from "@/lib/analytics";
import { jstParts, jstDate } from "@/lib/date";
import Topbar from "../Topbar";
import NewCollectionForm from "./NewCollectionForm";
import CollectionsTable from "./CollectionsTable";
import NewBankDepositForm from "./NewBankDepositForm";
import BankDepositsTable from "./BankDepositsTable";
import NewAdjustmentForm from "./NewAdjustmentForm";
import AdjustmentsTable from "./AdjustmentsTable";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };
const BASE_STORE_SLUG = "chura-re";

// 現金管理は2026年10月始まり（それより前の売上・経費は残高に含めない）
const START_DATE = jstDate(2026, 9, 1);

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

  const [stores, cashVisitRows, expenseRows, collections, deposits, adjustments] = await Promise.all([
    prisma.store.findMany({ where: { kind: { not: "VINTAGE" } }, orderBy: { createdAt: "asc" } }),
    prisma.visit.findMany({
      where: { paymentMethod: "cash", date: { gte: START_DATE } },
      select: { storeId: true, amount: true, productAmount: true, date: true },
    }),
    prisma.expense.findMany({ where: { date: { gte: START_DATE } }, select: { storeId: true, amount: true, date: true } }),
    prisma.cashCollection.findMany({ where: { date: { gte: START_DATE } }, include: { store: true }, orderBy: { date: "desc" } }),
    prisma.bankDeposit.findMany({ where: { date: { gte: START_DATE } }, orderBy: { date: "desc" } }),
    prisma.cashAdjustment.findMany({ where: { date: { gte: START_DATE } }, orderBy: { date: "desc" } }),
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

  const baseCashVisits = baseStore ? cashVisitRows.filter((v) => v.storeId === baseStore.id) : [];
  const baseExpenseRows = baseStore ? expenseRows.filter((e) => e.storeId === baseStore.id) : [];
  const baseCashSalesTotal = baseCashVisits.reduce((a, v) => a + v.amount + (v.productAmount ?? 0), 0);
  const baseExpenseTotal = baseExpenseRows.reduce((a, e) => a + e.amount, 0);
  const collectedTotal = collections.reduce((a, c) => a + c.amount, 0);
  const depositedTotal = deposits.reduce((a, d) => a + d.amount, 0);
  const adjustmentTotal = adjustments.reduce((a, x) => a + x.delta, 0);
  const cashBalance = baseCashSalesTotal - baseExpenseTotal + collectedTotal - depositedTotal + adjustmentTotal;

  // 月次繰越表（2026年10月〜今月）：前月末の残高を翌月の「前月繰越」として引き継ぐ
  const now = new Date();
  const nowJst = jstParts(now);
  const startJst = jstParts(START_DATE);
  const monthRows: {
    label: string;
    opening: number;
    cashSales: number;
    expense: number;
    collected: number;
    deposited: number;
    adjusted: number;
    closing: number;
  }[] = [];
  {
    let y = startJst.year;
    let m = startJst.month;
    let carry = 0;
    while (y < nowJst.year || (y === nowJst.year && m <= nowJst.month)) {
      const mStart = jstDate(y, m, 1);
      const mEnd = jstDate(y, m + 1, 1);
      const monthCashSales = baseCashVisits
        .filter((v) => v.date >= mStart && v.date < mEnd)
        .reduce((a, v) => a + v.amount + (v.productAmount ?? 0), 0);
      const monthExpense = baseExpenseRows.filter((e) => e.date >= mStart && e.date < mEnd).reduce((a, e) => a + e.amount, 0);
      const monthCollected = collections.filter((c) => c.date >= mStart && c.date < mEnd).reduce((a, c) => a + c.amount, 0);
      const monthDeposited = deposits.filter((d) => d.date >= mStart && d.date < mEnd).reduce((a, d) => a + d.amount, 0);
      const monthAdjusted = adjustments.filter((x) => x.date >= mStart && x.date < mEnd).reduce((a, x) => a + x.delta, 0);
      const opening = carry;
      const closing = opening + monthCashSales - monthExpense + monthCollected - monthDeposited + monthAdjusted;
      monthRows.push({
        label: `${y}年${m + 1}月`,
        opening,
        cashSales: monthCashSales,
        expense: monthExpense,
        collected: monthCollected,
        deposited: monthDeposited,
        adjusted: monthAdjusted,
        closing,
      });
      carry = closing;
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }
  const yearTotal = {
    cashSales: monthRows.reduce((a, r) => a + r.cashSales, 0),
    expense: monthRows.reduce((a, r) => a + r.expense, 0),
    collected: monthRows.reduce((a, r) => a + r.collected, 0),
    deposited: monthRows.reduce((a, r) => a + r.deposited, 0),
    adjusted: monthRows.reduce((a, r) => a + r.adjusted, 0),
    closing: monthRows.length > 0 ? monthRows[monthRows.length - 1].closing : 0,
  };
  const currentMonthRow = monthRows.length > 0 ? monthRows[monthRows.length - 1] : null;

  return (
    <>
      <Topbar title="現金管理" scopeLabel="全店舗" roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">現金残高（{baseStore?.name ?? "チュラ：re"}）</div>
            <div className="card-sub">
              {nowJst.year}年{nowJst.month + 1}月・2026年10月始まり（前月繰越＋今月の売上－経費＋回収－入金）
            </div>
            <div className="kpi-value" style={{ fontSize: 32, marginTop: 8 }}>
              {yen(cashBalance)}
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="field">
                <div className="field-label">前月繰越</div>
                <div className="field-value">{yen(currentMonthRow?.opening ?? 0)}</div>
              </div>
              <div className="field">
                <div className="field-label">今月の現金売上</div>
                <div className="field-value">＋{yen(currentMonthRow?.cashSales ?? 0)}</div>
              </div>
              <div className="field">
                <div className="field-label">今月の経費</div>
                <div className="field-value">－{yen(currentMonthRow?.expense ?? 0)}</div>
              </div>
              <div className="field">
                <div className="field-label">今月の回収</div>
                <div className="field-value">＋{yen(currentMonthRow?.collected ?? 0)}</div>
              </div>
              <div className="field">
                <div className="field-label">今月の銀行入金</div>
                <div className="field-value">－{yen(currentMonthRow?.deposited ?? 0)}</div>
              </div>
              <div className="field">
                <div className="field-label">今月の残高調整</div>
                <div className="field-value">
                  {(currentMonthRow?.adjusted ?? 0) > 0 ? "＋" : ""}
                  {yen(currentMonthRow?.adjusted ?? 0)}
                </div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-title">各店舗の現金売上・経費</div>
            <div className="card-sub">2026年10月〜今月の累計</div>
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

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title">月次現金出納表（{baseStore?.name ?? "チュラ：re"}）</div>
          <div className="card-sub">2026年10月始まり・前月繰越方式</div>
          <div className="table-wrap table-scroll">
            <table>
              <thead>
                <tr>
                  <th>月</th>
                  <th style={{ textAlign: "right" }}>前月繰越</th>
                  <th style={{ textAlign: "right" }}>現金売上</th>
                  <th style={{ textAlign: "right" }}>経費</th>
                  <th style={{ textAlign: "right" }}>回収</th>
                  <th style={{ textAlign: "right" }}>銀行入金</th>
                  <th style={{ textAlign: "right" }}>残高調整</th>
                  <th style={{ textAlign: "right" }}>月末残高</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((r) => (
                  <tr key={r.label}>
                    <td data-label="月">{r.label}</td>
                    <td data-label="前月繰越" style={{ textAlign: "right" }}>{yen(r.opening)}</td>
                    <td data-label="現金売上" style={{ textAlign: "right" }}>{yen(r.cashSales)}</td>
                    <td data-label="経費" style={{ textAlign: "right" }}>{yen(r.expense)}</td>
                    <td data-label="回収" style={{ textAlign: "right" }}>{yen(r.collected)}</td>
                    <td data-label="銀行入金" style={{ textAlign: "right" }}>{yen(r.deposited)}</td>
                    <td data-label="残高調整" style={{ textAlign: "right" }}>
                      {r.adjusted > 0 ? "＋" : ""}
                      {yen(r.adjusted)}
                    </td>
                    <td data-label="月末残高" style={{ textAlign: "right", fontWeight: 700 }}>{yen(r.closing)}</td>
                  </tr>
                ))}
              </tbody>
              {monthRows.length > 0 && (
                <tfoot>
                  <tr>
                    <td data-label="年合計" style={{ fontWeight: 700 }}>年合計</td>
                    <td data-label="前月繰越" style={{ textAlign: "right" }}>-</td>
                    <td data-label="現金売上" style={{ textAlign: "right", fontWeight: 700 }}>{yen(yearTotal.cashSales)}</td>
                    <td data-label="経費" style={{ textAlign: "right", fontWeight: 700 }}>{yen(yearTotal.expense)}</td>
                    <td data-label="回収" style={{ textAlign: "right", fontWeight: 700 }}>{yen(yearTotal.collected)}</td>
                    <td data-label="銀行入金" style={{ textAlign: "right", fontWeight: 700 }}>{yen(yearTotal.deposited)}</td>
                    <td data-label="残高調整" style={{ textAlign: "right", fontWeight: 700 }}>
                      {yearTotal.adjusted > 0 ? "＋" : ""}
                      {yen(yearTotal.adjusted)}
                    </td>
                    <td data-label="月末残高" style={{ textAlign: "right", fontWeight: 700 }}>{yen(yearTotal.closing)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
            {monthRows.length === 0 && <div className="card-sub" style={{ padding: 20 }}>まだ記録がありません。</div>}
          </div>
        </div>

        <NewCollectionForm stores={otherStores.map((s) => ({ id: s.id, name: s.name }))} />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <div className="card-title">回収履歴</div>
            <div className="card-sub">シェルバレー・リアンから運んだ現金の記録</div>
          </div>
          <CollectionsTable
            collections={collections}
            stores={otherStores.map((s) => ({ id: s.id, name: s.name }))}
          />
        </div>

        <NewBankDepositForm />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <div className="card-title">入金履歴</div>
            <div className="card-sub">チュラ：reの現金を銀行へ入金した記録</div>
          </div>
          <BankDepositsTable deposits={deposits} />
        </div>

        <NewAdjustmentForm currentBalance={cashBalance} />

        <div className="card">
          <div className="card-pad" style={{ paddingBottom: 0 }}>
            <div className="card-title">残高調整の履歴</div>
            <div className="card-sub">実際に数えた現金残高を入力した記録</div>
          </div>
          <AdjustmentsTable adjustments={adjustments} />
        </div>
      </div>
    </>
  );
}
