import { jstParts } from "./date";
import { parseSalesMonth, type ExportActor, type SalesMonth } from "./monthlySalesReport";

export function vintageReportMonth(value: unknown, now = new Date()): SalesMonth | null {
  if (value === undefined || value === null) {
    const parts = jstParts(now);
    return parseSalesMonth(`${parts.year}-${String(parts.month + 1).padStart(2, "0")}`);
  }
  return typeof value === "string" ? parseSalesMonth(value) : null;
}

export function canExportVintage(actor: ExportActor, store: { id: string; kind: string } | null): boolean {
  return !!store && store.kind === "VINTAGE" && actor.active &&
    (actor.role === "OWNER" || (["STAFF", "MANAGER"].includes(actor.role) && actor.storeId === store.id));
}

export type VintageExportSale = { date: Date; amount: number; paymentMethod: string | null };
export function aggregateVintageSales(month: SalesMonth, sales: VintageExportSale[]) {
  const rows = Array.from({ length: month.days }, (_, index) => ({ day: index + 1, cash: 0, credit: 0, unknown: 0 }));
  for (const sale of sales) {
    if (sale.date < month.start || sale.date >= month.end) continue;
    const row = rows[jstParts(sale.date).date - 1];
    if (!row) continue;
    if (sale.paymentMethod === "cash") row.cash += sale.amount;
    else if (sale.paymentMethod === "credit") row.credit += sale.amount;
    else row.unknown += sale.amount;
  }
  return rows;
}
