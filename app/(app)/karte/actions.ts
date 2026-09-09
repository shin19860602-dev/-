"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const schema = z.object({
  storeId: z.string().min(1),
  name: z.string().trim().min(1),
  kana: z.string().trim().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  birthday: z.string().optional(),
  phone: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  address: z.string().trim().optional(),
  tier: z.enum(["一般会員", "プレミアム会員"]),
  primaryStaffId: z.string().optional(),
  allergyNote: z.string().trim().optional(),
});

export async function createCustomer(formData: FormData) {
  const session = await requireSession();
  if (!session) return { ok: false as const, error: "ログインが必要です。" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const storeId = session.role === "OWNER" ? data.storeId : session.storeId!;

  if (data.primaryStaffId) {
    const staff = await prisma.staff.findFirst({ where: { id: data.primaryStaffId, storeId } });
    if (!staff) return { ok: false as const, error: "担当スタイリストが選択した店舗と一致しません。" };
  }

  const customer = await prisma.customer.create({
    data: {
      storeId,
      name: data.name,
      kana: data.kana || undefined,
      gender: data.gender,
      birthday: data.birthday ? new Date(data.birthday) : undefined,
      phone: data.phone || undefined,
      postalCode: data.postalCode || undefined,
      address: data.address || undefined,
      tier: data.tier,
      memberSince: new Date(),
      primaryStaffId: data.primaryStaffId || undefined,
      allergyNote: data.allergyNote || undefined,
    },
  });

  revalidatePath("/karte");
  revalidatePath("/sales");
  return { ok: true as const, customerId: customer.id };
}

const updateSchema = schema.extend({ customerId: z.string().min(1) });

export async function updateCustomer(formData: FormData) {
  const session = await requireSession();
  if (!session) return { ok: false as const, error: "ログインが必要です。" };

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const storeId = session.role === "OWNER" ? data.storeId : session.storeId!;

  const existing = await prisma.customer.findFirst({ where: { id: data.customerId, storeId } });
  if (!existing) return { ok: false as const, error: "お客様が見つかりません。" };

  if (data.primaryStaffId) {
    const staff = await prisma.staff.findFirst({ where: { id: data.primaryStaffId, storeId } });
    if (!staff) return { ok: false as const, error: "担当スタイリストが選択した店舗と一致しません。" };
  }

  await prisma.customer.update({
    where: { id: data.customerId },
    data: {
      name: data.name,
      kana: data.kana || null,
      gender: data.gender ?? null,
      birthday: data.birthday ? new Date(data.birthday) : null,
      phone: data.phone || null,
      postalCode: data.postalCode || null,
      address: data.address || null,
      tier: data.tier,
      primaryStaffId: data.primaryStaffId || null,
      allergyNote: data.allergyNote || null,
    },
  });

  revalidatePath("/karte");
  revalidatePath("/sales");
  return { ok: true as const, customerId: data.customerId };
}

export async function deleteCustomer(customerId: string) {
  const session = await requireSession();
  if (!session) return { ok: false as const, error: "ログインが必要です。" };

  const storeId = session.role === "OWNER" ? undefined : session.storeId!;
  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
  if (!customer) return { ok: false as const, error: "お客様が見つかりません。" };

  const visitCount = await prisma.visit.count({ where: { customerId } });

  if (visitCount === 0) {
    await prisma.customer.delete({ where: { id: customerId } });
  } else {
    // 施術履歴・売上記録が残っているため完全削除はせず、一覧から見えなくする
    await prisma.customer.update({ where: { id: customerId }, data: { active: false } });
  }

  revalidatePath("/karte");
  revalidatePath("/sales");
  return { ok: true as const, hidden: visitCount > 0 };
}
