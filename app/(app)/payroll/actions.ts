"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

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
