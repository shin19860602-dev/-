"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { jstDateWithTimeOf } from "@/lib/date";
import { sanitizeDigits } from "@/lib/format";

async function requireOwner() {
  const session = await requireSession();
  if (!session || session.role !== "OWNER") return null;
  return session;
}

const schema = z.object({
  storeId: z.string().min(1),
  date: z.string().min(1),
  amount: z.string().min(1),
  memo: z.string().trim().optional(),
});

export async function createCashCollection(formData: FormData) {
  const session = await requireOwner();
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const amount = Number(sanitizeDigits(data.amount));
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false as const, error: "金額をご確認ください。" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { ok: false as const, error: "日付をご確認ください。" };
  const date = jstDateWithTimeOf(data.date, new Date());

  await prisma.cashCollection.create({
    data: {
      storeId: data.storeId,
      staffId: session.staffId!,
      date,
      amount,
      memo: data.memo || undefined,
    },
  });

  revalidatePath("/cash");
  return { ok: true as const };
}

const updateSchema = z.object({
  collectionId: z.string().min(1),
  storeId: z.string().min(1),
  date: z.string().min(1),
  amount: z.string().min(1),
  memo: z.string().trim().optional(),
});

export async function updateCashCollection(formData: FormData) {
  const session = await requireOwner();
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const amount = Number(sanitizeDigits(data.amount));
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false as const, error: "金額をご確認ください。" };

  const collection = await prisma.cashCollection.findUnique({ where: { id: data.collectionId } });
  if (!collection) return { ok: false as const, error: "見つかりません。" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return { ok: false as const, error: "日付をご確認ください。" };
  const date = jstDateWithTimeOf(data.date, collection.date);

  await prisma.cashCollection.update({
    where: { id: data.collectionId },
    data: { storeId: data.storeId, date, amount, memo: data.memo || null },
  });

  revalidatePath("/cash");
  return { ok: true as const };
}

export async function deleteCashCollection(collectionId: string) {
  const session = await requireOwner();
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const collection = await prisma.cashCollection.findUnique({ where: { id: collectionId } });
  if (!collection) return { ok: false as const, error: "見つかりません。" };

  await prisma.cashCollection.delete({ where: { id: collectionId } });

  revalidatePath("/cash");
  return { ok: true as const };
}
