"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { jstDateWithTimeOf, jstDate } from "@/lib/date";
import { sanitizeDigits } from "@/lib/format";

async function requireOwner() {
  const session = await requireSession();
  if (!session || session.role !== "OWNER") return null;
  return session;
}

const BASE_STORE_SLUG = "chura-re";
const START_DATE = jstDate(2026, 9, 1);

// ページ側の計算（/cash）と同じロジックで「現在の計算上の残高」を求める。
// 新しい入出金の種類を増やす場合は、両方に同じ変更を反映すること。
async function computeCurrentCashBalance(): Promise<number> {
  const baseStore = await prisma.store.findUnique({ where: { slug: BASE_STORE_SLUG } });
  if (!baseStore) return 0;

  const [cashVisits, expenses, collections, deposits, adjustments] = await Promise.all([
    prisma.visit.findMany({
      where: { storeId: baseStore.id, paymentMethod: "cash", date: { gte: START_DATE } },
      select: { amount: true, productAmount: true },
    }),
    prisma.expense.findMany({ where: { storeId: baseStore.id, date: { gte: START_DATE } }, select: { amount: true } }),
    prisma.cashCollection.findMany({ where: { date: { gte: START_DATE } }, select: { amount: true } }),
    prisma.bankDeposit.findMany({ where: { date: { gte: START_DATE } }, select: { amount: true } }),
    prisma.cashAdjustment.findMany({ where: { date: { gte: START_DATE } }, select: { delta: true } }),
  ]);

  const cashSales = cashVisits.reduce((a, v) => a + v.amount + (v.productAmount ?? 0), 0);
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const collectedTotal = collections.reduce((a, c) => a + c.amount, 0);
  const depositedTotal = deposits.reduce((a, d) => a + d.amount, 0);
  const adjustmentTotal = adjustments.reduce((a, c) => a + c.delta, 0);

  return cashSales - expenseTotal + collectedTotal - depositedTotal + adjustmentTotal;
}

const schema = z.object({
  date: z.string().min(1),
  enteredBalance: z.string().min(1),
  memo: z.string().trim().optional(),
});

export async function createCashAdjustment(formData: FormData) {
  const session = await requireOwner();
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const enteredBalance = Number(sanitizeDigits(data.enteredBalance));
  if (!Number.isInteger(enteredBalance) || enteredBalance < 0) return { ok: false as const, error: "残高をご確認ください。" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { ok: false as const, error: "日付をご確認ください。" };
  const date = jstDateWithTimeOf(data.date, new Date());

  const currentBalance = await computeCurrentCashBalance();
  const delta = enteredBalance - currentBalance;

  await prisma.cashAdjustment.create({
    data: { staffId: session.staffId!, date, enteredBalance, delta, memo: data.memo || undefined },
  });

  revalidatePath("/cash");
  return { ok: true as const };
}

export async function deleteCashAdjustment(adjustmentId: string) {
  const session = await requireOwner();
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const adjustment = await prisma.cashAdjustment.findUnique({ where: { id: adjustmentId } });
  if (!adjustment) return { ok: false as const, error: "見つかりません。" };

  await prisma.cashAdjustment.delete({ where: { id: adjustmentId } });

  revalidatePath("/cash");
  return { ok: true as const };
}
