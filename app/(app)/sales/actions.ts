"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const schema = z.object({
  storeId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  newCustomerName: z.string().trim().min(1).optional(),
  newCustomerGender: z.enum(["male", "female", "other"]).optional(),
  menuName: z.string().trim().min(1),
  amount: z.coerce.number().int().positive(),
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
      data: { storeId, name: data.newCustomerName, gender: data.newCustomerGender, tier: "一般会員" },
    });
    customerId = created.id;
  }
  if (!customerId) return { ok: false as const, error: "お客様を選択するか、新規のお客様名を入力してください。" };

  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
  if (!customer) return { ok: false as const, error: "お客様が選択した店舗と一致しません。" };

  await prisma.visit.create({
    data: {
      storeId,
      staffId,
      customerId: customer.id,
      date: new Date(),
      menuName: data.menuName,
      amount: data.amount,
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
