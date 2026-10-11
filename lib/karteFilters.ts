import type { Prisma } from "@prisma/client";
import { jstDate, jstParts } from "./date";

export type KarteFilters = {
  store?: string;
  q?: string;
  customer?: string;
  gender?: string;
  category?: string;
  from?: string;
  to?: string;
};

function parseDay(value: string | undefined) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = jstDate(year, month - 1, day);
  const parts = jstParts(date);
  return parts.year === year && parts.month === month - 1 && parts.date === day ? date : null;
}

export function buildKarteWhere(filters: KarteFilters, storeId?: string): { where: Prisma.CustomerWhereInput; error?: string } {
  const where: Prisma.CustomerWhereInput = { storeId, active: true };
  const q = filters.q?.trim();
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { kana: { contains: q, mode: "insensitive" } }];
  if (["male", "female", "other"].includes(filters.gender ?? "")) where.gender = filters.gender;
  if (filters.gender === "unknown") where.gender = null;

  const from = parseDay(filters.from);
  const to = parseDay(filters.to);
  if (from === null || to === null) return { where, error: "来店日を正しい日付で入力してください。" };
  if (from && to && from > to) return { where, error: "来店日の開始日は終了日以前にしてください。" };

  if (filters.category || from || to) {
    const visit: Prisma.VisitWhereInput = { storeId };
    if (filters.category === "uncategorized") {
      visit.OR = [{ category: null }, { category: "" }];
    } else if (filters.category) {
      visit.category = filters.category;
    }
    if (from || to) {
      const end = to ? jstParts(to) : undefined;
      visit.date = { gte: from, lt: end ? jstDate(end.year, end.month, end.date + 1) : undefined };
    }
    // カテゴリと期間は、同じ来店記録に一致する必要がある。
    where.visits = { some: visit };
  }
  return { where };
}
