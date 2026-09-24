"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { jstDateWithTimeOf } from "@/lib/date";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { sanitizeDigits } from "@/lib/format";

function revalidateExpensePaths() {
  revalidatePath("/sales");
  revalidatePath("/dashboard");
}

const schema = z.object({
  storeId: z.string().min(1),
  date: z.string().min(1),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.string().min(1),
  memo: z.string().trim().optional(),
});

export async function createExpense(formData: FormData) {
  const session = await requireSession();
  if (!session) return { ok: false as const, error: "ログインが必要です。" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const amount = Number(sanitizeDigits(data.amount));
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false as const, error: "金額をご確認ください。" };

  // オーナー以外は自店舗にロック（クライアント側の値を信用しない）
  const storeId = session.role === "OWNER" ? data.storeId : session.storeId!;
  const staffId = session.staffId!;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { ok: false as const, error: "日付をご確認ください。" };
  const date = jstDateWithTimeOf(data.date, new Date());

  await prisma.expense.create({
    data: {
      storeId,
      staffId,
      date,
      category: data.category,
      amount,
      memo: data.memo || undefined,
    },
  });

  revalidateExpensePaths();
  return { ok: true as const };
}

const updateSchema = z.object({
  expenseId: z.string().min(1),
  date: z.string().min(1),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.string().min(1),
  memo: z.string().trim().optional(),
});

async function canManageExpense(storeId: string) {
  const session = await requireSession();
  if (!session) return null;
  if (session.role !== "OWNER" && session.storeId !== storeId) return null;
  return session;
}

export async function updateExpense(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const amount = Number(sanitizeDigits(data.amount));
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false as const, error: "金額をご確認ください。" };

  const expense = await prisma.expense.findUnique({ where: { id: data.expenseId } });
  if (!expense) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageExpense(expense.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { ok: false as const, error: "日付をご確認ください。" };
  const date = jstDateWithTimeOf(data.date, expense.date);

  await prisma.expense.update({
    where: { id: data.expenseId },
    data: {
      date,
      category: data.category,
      amount,
      memo: data.memo || null,
    },
  });

  revalidateExpensePaths();
  return { ok: true as const };
}

export async function deleteExpense(expenseId: string) {
  const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!expense) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageExpense(expense.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.expense.delete({ where: { id: expenseId } });

  revalidateExpensePaths();
  return { ok: true as const };
}
