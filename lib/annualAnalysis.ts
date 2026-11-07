import { jstParts } from "./date";

export type AnnualVisit = {
  date: Date; customerId: string; amount: number; productAmount: number | null;
  pointAmount: number | null; menuName: string;
};
export function analyzeYear(visits: AnnualVisit[]) {
  const months = Array.from({ length: 12 }, () => ({ sales: 0, count: 0, imported: false }));
  const menus = new Map<string, { count: number; sales: number }>();
  let imported = false;
  const customers = new Set<string>();
  for (const v of visits) {
    const month = months[jstParts(v.date).month];
    month.sales += v.amount + (v.productAmount ?? 0) + (v.pointAmount ?? 0);
    if (v.menuName.includes("一括インポート")) {
      imported = month.imported = true;
      continue;
    }
    month.count++;
    customers.add(v.customerId);
    const label = v.menuName.trim() || "メニュー未登録";
    const menu = menus.get(label) ?? { count: 0, sales: 0 };
    menu.count++;
    menu.sales += v.amount + (v.pointAmount ?? 0);
    menus.set(label, menu);
  }
  return { months, menus, imported, customers: customers.size, count: months.reduce((s, m) => s + m.count, 0) };
}
