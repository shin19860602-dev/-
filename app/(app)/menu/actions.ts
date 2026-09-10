"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const createSchema = z.object({
  storeId: z.string().min(1),
  type: z.enum(["service", "product"]),
  name: z.string().trim().min(1),
  price: z.coerce.number().int().min(0),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  price: z.coerce.number().int().min(0),
});

async function canManage(storeId: string) {
  const session = await requireSession();
  if (!session) return null;
  if (session.role !== "OWNER" && session.role !== "MANAGER") return null;
  if (session.role === "MANAGER" && session.storeId !== storeId) return null;
  return session;
}

export async function createMenuItem(formData: FormData) {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const session = await canManage(data.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const last = await prisma.menuItem.findFirst({
    where: { storeId: data.storeId, type: data.type },
    orderBy: { sortOrder: "desc" },
  });

  await prisma.menuItem.create({
    data: { storeId: data.storeId, type: data.type, name: data.name, price: data.price, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });

  revalidatePath("/menu");
  revalidatePath("/sales");
  return { ok: true as const };
}

export async function setMenuItemActive(id: string, active: boolean) {
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return { ok: false as const, error: "見つかりません。" };

  const session = await canManage(item.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.menuItem.update({ where: { id }, data: { active } });

  revalidatePath("/menu");
  revalidatePath("/sales");
  return { ok: true as const };
}

export async function updateMenuItem(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const item = await prisma.menuItem.findUnique({ where: { id: data.id } });
  if (!item) return { ok: false as const, error: "見つかりません。" };

  const session = await canManage(item.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.menuItem.update({ where: { id: data.id }, data: { name: data.name, price: data.price } });

  revalidatePath("/menu");
  revalidatePath("/sales");
  return { ok: true as const };
}

export async function moveMenuItem(id: string, direction: "up" | "down") {
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return { ok: false as const, error: "見つかりません。" };

  const session = await canManage(item.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const neighbor = await prisma.menuItem.findFirst({
    where: {
      storeId: item.storeId,
      type: item.type,
      sortOrder: direction === "up" ? { lt: item.sortOrder } : { gt: item.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return { ok: true as const };

  await prisma.$transaction([
    prisma.menuItem.update({ where: { id: item.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.menuItem.update({ where: { id: neighbor.id }, data: { sortOrder: item.sortOrder } }),
  ]);

  revalidatePath("/menu");
  revalidatePath("/sales");
  return { ok: true as const };
}

export async function deleteMenuItem(id: string) {
  const item = await prisma.menuItem.findUnique({ where: { id } });
  if (!item) return { ok: false as const, error: "見つかりません。" };

  const session = await canManage(item.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.menuItem.delete({ where: { id } });

  revalidatePath("/menu");
  revalidatePath("/sales");
  return { ok: true as const };
}
