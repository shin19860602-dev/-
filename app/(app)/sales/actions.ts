"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const schema = z.object({
  storeId: z.string().min(1),
  date: z.string().min(1),
  customerId: z.string().min(1).optional(),
  newCustomerName: z.string().trim().min(1).optional(),
  newCustomerKana: z.string().trim().optional(),
  newCustomerGender: z.enum(["male", "female", "other"]).optional(),
  couponName: z.string().trim().optional(),
  couponAmount: z.string().optional(),
  menuName: z.string().trim().optional(),
  menuAmount: z.string().optional(),
  pointAmount: z.string().optional(),
  productName: z.string().trim().optional(),
  productAmount: z.string().optional(),
  paymentMethod: z.enum(["cash", "credit"]),
  memo: z.string().trim().optional(),
});

export async function createVisit(formData: FormData) {
  const session = await requireSession();
  if (!session) return { ok: false as const, error: "ログインが必要です。" };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: "入力内容をご確認ください。" };
  }
  const data = parsed.data;

  const productName = data.productName || undefined;
  const productAmount = data.productAmount ? Number(data.productAmount) : undefined;
  if (productName && !productAmount) return { ok: false as const, error: "店販の金額を入力してください。" };
  if (!productName && productAmount) return { ok: false as const, error: "店販の商品メニューを入力してください。" };
  if (productAmount !== undefined && (!Number.isInteger(productAmount) || productAmount <= 0)) {
    return { ok: false as const, error: "店販の金額をご確認ください。" };
  }

  // クーポンとメニューはそれぞれ任意だが、名前と金額はセットで入力する（技術売上＝両者の合計）
  const couponName = data.couponName || undefined;
  const couponAmount = data.couponAmount ? Number(data.couponAmount) : undefined;
  if (couponName && !couponAmount) return { ok: false as const, error: "クーポンの金額を入力してください。" };
  if (!couponName && couponAmount) return { ok: false as const, error: "クーポンのメニュー名を入力してください。" };
  if (couponAmount !== undefined && (!Number.isInteger(couponAmount) || couponAmount <= 0)) {
    return { ok: false as const, error: "クーポンの金額をご確認ください。" };
  }

  const menuName = data.menuName || undefined;
  const menuAmount = data.menuAmount ? Number(data.menuAmount) : undefined;
  if (menuName && !menuAmount) return { ok: false as const, error: "メニューの金額を入力してください。" };
  if (!menuName && menuAmount) return { ok: false as const, error: "メニューの名前を入力してください。" };
  if (menuAmount !== undefined && (!Number.isInteger(menuAmount) || menuAmount <= 0)) {
    return { ok: false as const, error: "メニューの金額をご確認ください。" };
  }

  const amount = (couponAmount ?? 0) + (menuAmount ?? 0);
  if (amount <= 0) return { ok: false as const, error: "クーポンまたはメニューを入力してください。" };
  const combinedMenuName = [couponName, menuName].filter(Boolean).join("／");

  const pointAmount = data.pointAmount ? Number(data.pointAmount) : undefined;
  if (pointAmount !== undefined && (!Number.isInteger(pointAmount) || pointAmount <= 0)) {
    return { ok: false as const, error: "ポイント売上の金額をご確認ください。" };
  }

  // オーナー以外は自店舗にロック（クライアント側の値を信用しない）
  const storeId = session.role === "OWNER" ? data.storeId : session.storeId!;

  // 担当スタッフは選択させず、ログイン中の本人を自動的に記録する
  const staffId = session.staffId!;

  let customerId = data.customerId;
  if (!customerId && data.newCustomerName) {
    const created = await prisma.customer.create({
      data: { storeId, name: data.newCustomerName, kana: data.newCustomerKana || undefined, gender: data.newCustomerGender, tier: "一般会員" },
    });
    customerId = created.id;
  }
  if (!customerId) return { ok: false as const, error: "お客様を選択するか、新規のお客様名を入力してください。" };

  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
  if (!customer) return { ok: false as const, error: "お客様が選択した店舗と一致しません。" };

  const [dateY, dateM, dateD] = data.date.split("-").map(Number);
  if (!dateY || !dateM || !dateD) return { ok: false as const, error: "日付をご確認ください。" };
  const now = new Date();
  const date = new Date(dateY, dateM - 1, dateD, now.getHours(), now.getMinutes(), now.getSeconds());

  await prisma.visit.create({
    data: {
      storeId,
      staffId,
      customerId: customer.id,
      date,
      menuName: combinedMenuName,
      amount,
      pointAmount,
      productName,
      productAmount,
      paymentMethod: data.paymentMethod,
      memo: data.memo || undefined,
    },
  });

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/karte");
  revalidatePath("/analytics");
  return { ok: true as const };
}

const updateSchema = z.object({
  visitId: z.string().min(1),
  date: z.string().min(1),
  menuName: z.string().trim().min(1),
  amount: z.coerce.number().int().positive(),
  pointAmount: z.string().optional(),
  productName: z.string().trim().optional(),
  productAmount: z.string().optional(),
  paymentMethod: z.enum(["cash", "credit"]),
  memo: z.string().trim().optional(),
});

async function canManageVisit(storeId: string) {
  const session = await requireSession();
  if (!session) return null;
  if (session.role !== "OWNER" && session.storeId !== storeId) return null;
  return session;
}

export async function updateVisit(formData: FormData) {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false as const, error: "入力内容をご確認ください。" };
  const data = parsed.data;

  const productName = data.productName || undefined;
  const productAmount = data.productAmount ? Number(data.productAmount) : undefined;
  if (productName && !productAmount) return { ok: false as const, error: "店販の金額を入力してください。" };
  if (!productName && productAmount) return { ok: false as const, error: "店販の商品メニューを入力してください。" };
  if (productAmount !== undefined && (!Number.isInteger(productAmount) || productAmount <= 0)) {
    return { ok: false as const, error: "店販の金額をご確認ください。" };
  }

  const pointAmount = data.pointAmount ? Number(data.pointAmount) : undefined;
  if (pointAmount !== undefined && (!Number.isInteger(pointAmount) || pointAmount <= 0)) {
    return { ok: false as const, error: "ポイント売上の金額をご確認ください。" };
  }

  const visit = await prisma.visit.findUnique({ where: { id: data.visitId } });
  if (!visit) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageVisit(visit.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  const [dateY, dateM, dateD] = data.date.split("-").map(Number);
  if (!dateY || !dateM || !dateD) return { ok: false as const, error: "日付をご確認ください。" };
  const original = visit.date;
  const date = new Date(dateY, dateM - 1, dateD, original.getHours(), original.getMinutes(), original.getSeconds());

  await prisma.visit.update({
    where: { id: data.visitId },
    data: {
      date,
      menuName: data.menuName,
      amount: data.amount,
      pointAmount: pointAmount ?? null,
      productName: productName ?? null,
      productAmount: productAmount ?? null,
      paymentMethod: data.paymentMethod,
      memo: data.memo || null,
    },
  });

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/karte");
  revalidatePath("/analytics");
  return { ok: true as const };
}

export async function deleteVisit(visitId: string) {
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) return { ok: false as const, error: "見つかりません。" };

  const session = await canManageVisit(visit.storeId);
  if (!session) return { ok: false as const, error: "権限がありません。" };

  await prisma.visit.delete({ where: { id: visitId } });

  revalidatePath("/sales");
  revalidatePath("/dashboard");
  revalidatePath("/karte");
  revalidatePath("/analytics");
  return { ok: true as const };
}
