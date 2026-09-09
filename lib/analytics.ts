import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function monthBounds(base: Date, offsetMonths: number) {
  const start = new Date(base.getFullYear(), base.getMonth() + offsetMonths, 1);
  const end = new Date(base.getFullYear(), base.getMonth() + offsetMonths + 1, 1);
  return { start, end };
}

export function dayBounds(base: Date, offsetDays: number) {
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return { start, end };
}

// 同じ月日のまま年だけずらす（例: 去年の今日）
export function sameDayBounds(base: Date, offsetYears: number) {
  const start = new Date(base.getFullYear() + offsetYears, base.getMonth(), base.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return { start, end };
}

// その年の1/1〜今日（年間まとめの「年初来」集計に使う）
export function yearToDateBounds(base: Date, offsetYears: number) {
  const start = new Date(base.getFullYear() + offsetYears, 0, 1);
  const end = new Date(base.getFullYear() + offsetYears, base.getMonth(), base.getDate() + 1);
  return { start, end };
}

export function pctDelta(current: number, previous: number): { pct: number; dir: "up" | "down" | "flat" } {
  if (previous === 0) return { pct: current === 0 ? 0 : 100, dir: current > 0 ? "up" : "flat" };
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct), dir: pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat" };
}

export type VisitWithRelations = Prisma.VisitGetPayload<{
  include: { staff: { include: { store: true } }; customer: true; store: true };
}>;

export async function findVisits(where: Prisma.VisitWhereInput) {
  return prisma.visit.findMany({
    where,
    include: { staff: { include: { store: true } }, customer: true, store: true },
    orderBy: { date: "desc" },
  });
}

export async function repeatRate(storeId: string | undefined, monthStart: Date, monthEnd: Date) {
  const visits = await prisma.visit.findMany({
    where: { storeId, date: { gte: monthStart, lt: monthEnd } },
    select: { customerId: true },
  });
  if (visits.length === 0) return 0;
  const customerIds = [...new Set(visits.map((v) => v.customerId))];
  const priorVisits = await prisma.visit.findMany({
    where: { storeId, customerId: { in: customerIds }, date: { lt: monthStart } },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  const returning = new Set(priorVisits.map((v) => v.customerId));
  const repeatCount = visits.filter((v) => returning.has(v.customerId)).length;
  return (repeatCount / visits.length) * 100;
}

export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}

export const yen = (n: number) => `¥${Math.round(n).toLocaleString("ja-JP")}`;

// 施術金額＋店販金額＋ポイント売上の合計（売上として集計する際は常にこちらを使う）
export function visitTotal(v: { amount: number; productAmount?: number | null; pointAmount?: number | null }): number {
  return v.amount + (v.productAmount ?? 0) + (v.pointAmount ?? 0);
}

export function summarizeVisits(
  visits: { amount: number; productAmount?: number | null; pointAmount?: number | null; customer: { id: string; gender?: string | null } }[]
) {
  const genderByCustomer = new Map<string, string | null | undefined>();
  for (const v of visits) genderByCustomer.set(v.customer.id, v.customer.gender);

  const genderCounts = new Map<string, number>();
  for (const gender of genderByCustomer.values()) {
    const key = gender ?? "unknown";
    genderCounts.set(key, (genderCounts.get(key) ?? 0) + 1);
  }

  const serviceTotal = visits.reduce((a, v) => a + v.amount, 0);
  const productTotal = visits.reduce((a, v) => a + (v.productAmount ?? 0), 0);
  const pointTotal = visits.reduce((a, v) => a + (v.pointAmount ?? 0), 0);
  const visitCount = visits.length;
  const customerCount = genderByCustomer.size;

  return {
    customerCount,
    genderCounts,
    serviceTotal,
    productTotal,
    pointTotal,
    total: serviceTotal + productTotal + pointTotal,
    visitCount,
    serviceAvg: visitCount ? serviceTotal / visitCount : 0,
    productAvg: visitCount ? productTotal / visitCount : 0,
    pointAvg: visitCount ? pointTotal / visitCount : 0,
    avgPerCustomer: customerCount ? (serviceTotal + productTotal + pointTotal) / customerCount : 0,
  };
}

export type PeriodSummary = ReturnType<typeof summarizeVisits>;
