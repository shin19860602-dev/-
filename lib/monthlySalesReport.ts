import { jstDate, jstParts } from "./date";

export type SalesMonth = { value: string; year: number; month: number; days: number; start: Date; end: Date };
export function parseSalesMonth(value: string): SalesMonth | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  const [year, month] = value.split("-").map(Number);
  if (year < 2000 || year > 9999) return null;
  return { value, year, month, days: new Date(Date.UTC(year, month, 0)).getUTCDate(), start: jstDate(year, month - 1, 1), end: jstDate(year, month, 1) };
}

export type ExportActor = { role: string; storeId: string | null; active: boolean };
export type ExportStore = { id: string; slug: string; name: string; kind: string };
export function monthlyExportScope(actor: ExportActor, stores: ExportStore[], slug?: string | null) {
  if (!actor.active || !["OWNER", "MANAGER", "STAFF"].includes(actor.role)) return null;
  const allowed = stores.filter(store => ["SALON", "LASH"].includes(store.kind) && (actor.role === "OWNER" || store.id === actor.storeId));
  const selected = slug ? allowed.filter(store => store.slug === slug) : allowed;
  if (!selected.length) return null;
  return { storeIds: selected.map(store => store.id), label: selected.length === 1 ? selected[0].name : "全サロン" };
}

export type ExportVisit = { date: Date; amount: number; productAmount: number | null; pointAmount: number | null; paymentMethod: string | null };
export type ExportExpense = { date: Date; amount: number };
export type DailySalesRow = { day: number; cash: number; credit: number; points: number; productCash: number; productCredit: number; expenses: number; unknownService: number; unknownProduct: number };
export function aggregateMonthlySales(month: SalesMonth, visits: ExportVisit[], expenses: ExportExpense[]): DailySalesRow[] {
  const rows: DailySalesRow[] = Array.from({ length: month.days }, (_, i) => ({ day: i + 1, cash: 0, credit: 0, points: 0, productCash: 0, productCredit: 0, expenses: 0, unknownService: 0, unknownProduct: 0 }));
  const rowFor = (date: Date) => date >= month.start && date < month.end ? rows[jstParts(date).date - 1] : undefined;
  for (const visit of visits) {
    const row = rowFor(visit.date);
    if (!row) continue;
    // amount is already the registered technical amount; do not subtract points twice.
    row.points += visit.pointAmount ?? 0;
    if (visit.paymentMethod === "cash") { row.cash += visit.amount; row.productCash += visit.productAmount ?? 0; }
    else if (visit.paymentMethod === "credit") { row.credit += visit.amount; row.productCredit += visit.productAmount ?? 0; }
    else { row.unknownService += visit.amount; row.unknownProduct += visit.productAmount ?? 0; }
  }
  for (const expense of expenses) { const row = rowFor(expense.date); if (row) row.expenses += expense.amount; }
  return rows;
}
