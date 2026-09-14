"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const schema = z.object({
  storeId: z.string().min(1),
  date: z.string().min(1),
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  amount: z.string().min(1),
  paymentMethod: z.enum(["cash", "credit"]),
  memo: z.string().trim().optional(),
});

export async function createVintageSale(formData: FormData) {
  const session = await requireSession();
  if (!session) return { ok: false as const, error: "ログインが必要です。" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const amount = Number(data.amount);
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false as const, error: "金額をご確認ください。" };

  // オーナー以外は自店舗にロック（クライアント側の値を信用しない）
  const storeId = session.role === "OWNER" ? data.storeId : session.storeId!;
  const staffId = session.staffId!;

  const [y, m, d] = data.date.split("-").map(Number);
  if (!y || !m || !d) return { ok: false as const, error: "日付をご確認ください。" };
  const now = new Date();
  const date = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());

  await prisma.vintageSale.create({
    data: {
      storeId,
      staffId,
      date,
      category: data.category || undefined,
      brand: data.brand || undefined,
      amount,
      paymentMethod: data.paymentMethod,
      memo: data.memo || undefined,
    },
  });

  revalidatePath("/vintage");
  return { ok: true as const };
}

const updateSchema = z.object({
  saleId: z.string().min(1),
  date: z.string().min(1),
  category: z.string().trim().optional(),
  brand: z.string().trim().optional(),
  amount: z.string().min(1),
  paymentMethod: z.enum(["cash", "credit"]),
  memo: z.string().trim().optional(),
});

async function canManageSale(storeId: string) {
  const session = await requireSession();
  if (!session) return null;
  if (session.role !== "OWNER" && session.storeId !== storeId) return null;
  return session;
}

export async function updateVintageSale(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const amount = Number(data.amount);
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false as const, error: "金額をご確認ください。" };

  const sale = await prisma.vintageSale.findUnique({ where: { id: data.saleId } });
  if (!sale) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageSale(sale.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const [y, mo, d] = data.date.split("-").map(Number);
  if (!y || !mo || !d) return { ok: false as const, error: "日付をご確認ください。" };
  const original = sale.date;
  const date = new Date(y, mo - 1, d, original.getHours(), original.getMinutes(), original.getSeconds());

  await prisma.vintageSale.update({
    where: { id: data.saleId },
    data: {
      date,
      category: data.category || null,
      brand: data.brand || null,
      amount,
      paymentMethod: data.paymentMethod,
      memo: data.memo || null,
    },
  });

  revalidatePath("/vintage");
  return { ok: true as const };
}

export async function deleteVintageSale(saleId: string) {
  const sale = await prisma.vintageSale.findUnique({ where: { id: saleId } });
  if (!sale) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageSale(sale.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.vintageSale.delete({ where: { id: saleId } });

  revalidatePath("/vintage");
  return { ok: true as const };
}

const createTagSchema = z.object({
  storeId: z.string().min(1),
  kind: z.enum(["category", "brand"]),
  name: z.string().trim().min(1),
});

async function canManageTags(storeId: string) {
  const session = await requireSession();
  if (!session) return null;
  if (session.role !== "OWNER" && session.role !== "MANAGER") return null;
  if (session.role === "MANAGER" && session.storeId !== storeId) return null;
  return session;
}

function revalidateVintagePaths() {
  revalidatePath("/vintage");
  revalidatePath("/vintage/dashboard");
  revalidatePath("/vintage/settings");
}

export async function createVintageTag(formData: FormData) {
  const parsed = createTagSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const session = await canManageTags(data.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const last = await prisma.vintageTag.findFirst({
    where: { storeId: data.storeId, kind: data.kind },
    orderBy: { sortOrder: "desc" },
  });

  await prisma.vintageTag.create({
    data: { storeId: data.storeId, kind: data.kind, name: data.name, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  revalidateVintagePaths();
  return { ok: true as const };
}

export async function setVintageTagActive(id: string, active: boolean) {
  const tag = await prisma.vintageTag.findUnique({ where: { id } });
  if (!tag) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageTags(tag.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.vintageTag.update({ where: { id }, data: { active } });

  revalidateVintagePaths();
  return { ok: true as const };
}

const updateTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
});

export async function updateVintageTag(formData: FormData) {
  const parsed = updateTagSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const tag = await prisma.vintageTag.findUnique({ where: { id: data.id } });
  if (!tag) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageTags(tag.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.vintageTag.update({ where: { id: data.id }, data: { name: data.name } });

  revalidateVintagePaths();
  return { ok: true as const };
}

export async function moveVintageTag(id: string, direction: "up" | "down") {
  const tag = await prisma.vintageTag.findUnique({ where: { id } });
  if (!tag) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageTags(tag.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const neighbor = await prisma.vintageTag.findFirst({
    where: {
      storeId: tag.storeId,
      kind: tag.kind,
      sortOrder: direction === "up" ? { lt: tag.sortOrder } : { gt: tag.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return { ok: true as const };

  await prisma.$transaction([
    prisma.vintageTag.update({ where: { id: tag.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.vintageTag.update({ where: { id: neighbor.id }, data: { sortOrder: tag.sortOrder } }),
  ]);

  revalidateVintagePaths();
  return { ok: true as const };
}

export async function deleteVintageTag(id: string) {
  const tag = await prisma.vintageTag.findUnique({ where: { id } });
  if (!tag) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageTags(tag.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.vintageTag.delete({ where: { id } });

  revalidateVintagePaths();
  return { ok: true as const };
}
