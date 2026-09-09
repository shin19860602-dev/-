"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const schema = z.object({
  storeId: z.string().min(1),
  name: z.string().trim().min(1),
  title: z.string().trim().min(1),
  role: z.enum(["MANAGER", "STAFF"]),
  pin: z.string().regex(/^\d{4}$/, "4桁の数字で入力してください"),
  hireDate: z.string().optional(),
});

export async function createStaff(formData: FormData) {
  const session = await requireSession();
  if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
    return { ok: false as const, error: "権限がありません。" };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "入力内容をご確認ください。" };
  }
  const data = parsed.data;

  // マネージャーは自店舗にしかスタッフを追加できない
  const storeId = session.role === "OWNER" ? data.storeId : session.storeId!;

  // 同じ店舗内でPINが重複すると誰のログインか判別できないため、重複チェックする
  const storeMates = await prisma.staff.findMany({
    where: { storeId, active: true, role: { not: "OWNER" }, pinHash: { not: null } },
  });
  for (const mate of storeMates) {
    if (await bcrypt.compare(data.pin, mate.pinHash!)) {
      return { ok: false as const, error: "このPINは同じ店舗の他のスタッフが使用中です。別の番号にしてください。" };
    }
  }

  const pinHash = await bcrypt.hash(data.pin, 10);
  await prisma.staff.create({
    data: {
      storeId,
      name: data.name,
      title: data.title,
      role: data.role,
      pinHash,
      hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
    },
  });

  revalidatePath("/staff");
  return { ok: true as const };
}

export async function setStaffActive(id: string, active: boolean) {
  const session = await requireSession();
  if (!session || (session.role !== "OWNER" && session.role !== "MANAGER")) {
    return { ok: false as const, error: "権限がありません。" };
  }

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) return { ok: false as const, error: "見つかりません。" };
  if (staff.role === "OWNER") return { ok: false as const, error: "オーナーは変更できません。" };
  if (session.role === "MANAGER" && session.storeId !== staff.storeId) {
    return { ok: false as const, error: "権限がありません。" };
  }

  await prisma.staff.update({ where: { id }, data: { active } });

  revalidatePath("/staff");
  return { ok: true as const };
}
