"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const MAX_UNLOCK_ATTEMPTS = 5;
const UNLOCK_LOCK_MINUTES = 15;

const schema = z.object({
  staffId: z.string().min(1),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.string().optional(),
  memo: z.string().trim().optional(),
});

export async function saveSalary(formData: FormData) {
  const session = await requireSession();
  if (!session || session.role !== "OWNER") return { ok: false as const, error: "権限がありません。" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const amount = data.amount ? Number(data.amount) : 0;
  if (!Number.isInteger(amount) || amount < 0) return { ok: false as const, error: "金額をご確認ください。" };

  const staff = await prisma.staff.findUnique({ where: { id: data.staffId } });
  if (!staff) return { ok: false as const, error: "スタッフが見つかりません。" };

  await prisma.salary.upsert({
    where: { staffId_yearMonth: { staffId: data.staffId, yearMonth: data.yearMonth } },
    update: { amount, memo: data.memo || null },
    create: { staffId: data.staffId, yearMonth: data.yearMonth, amount, memo: data.memo || undefined },
  });

  revalidatePath("/payroll");
  return { ok: true as const };
}

const passwordSchema = z.object({
  storeId: z.string().min(1),
  password: z.string().min(4, "4文字以上で入力してください"),
});

// オーナーが店舗ごとの給料閲覧用パスワードを設定・変更する
export async function setPayrollPassword(formData: FormData) {
  const session = await requireSession();
  if (!session || session.role !== "OWNER") return { ok: false as const, error: "権限がありません。" };

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください。" };

  const payrollPassword = await bcrypt.hash(parsed.data.password, 10);
  await prisma.store.update({
    where: { id: parsed.data.storeId },
    data: { payrollPassword, payrollFailedAttempts: 0, payrollLockedUntil: null },
  });

  revalidatePath("/payroll");
  return { ok: true as const };
}

const unlockSchema = z.object({
  storeId: z.string().min(1),
  password: z.string().min(1),
});

// スタッフ・マネージャーが自店舗の給料閲覧ロックを解除する
export async function unlockPayroll(formData: FormData) {
  const session = await requireSession();
  if (!session) return { ok: false as const, error: "ログインが必要です。" };

  const parsed = unlockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };

  // オーナー以外は自店舗にロック（クライアント側の値を信用しない）
  const storeId = session.role === "OWNER" ? parsed.data.storeId : session.storeId!;

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return { ok: false as const, error: "店舗が見つかりません。" };
  if (!store.payrollPassword) return { ok: false as const, error: "閲覧用パスワードが設定されていません。オーナーに設定を依頼してください。" };

  if (store.payrollLockedUntil && store.payrollLockedUntil > new Date()) {
    return { ok: false as const, error: "試行回数が上限に達しました。しばらくしてから再度お試しください。" };
  }

  const valid = await bcrypt.compare(parsed.data.password, store.payrollPassword);
  if (!valid) {
    const attempts = store.payrollFailedAttempts + 1;
    const lockedUntil = attempts >= MAX_UNLOCK_ATTEMPTS ? new Date(Date.now() + UNLOCK_LOCK_MINUTES * 60_000) : null;
    await prisma.store.update({ where: { id: storeId }, data: { payrollFailedAttempts: attempts, payrollLockedUntil: lockedUntil } });
    return { ok: false as const, error: lockedUntil ? "試行回数が上限に達しました。しばらくしてから再度お試しください。" : "パスワードが違います。" };
  }

  await prisma.store.update({ where: { id: storeId }, data: { payrollFailedAttempts: 0, payrollLockedUntil: null } });

  session.payrollUnlockedStoreId = storeId;
  await session.save();

  revalidatePath("/payroll");
  return { ok: true as const };
}
