"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function createAccountant(form: FormData) {
 const session = await requireSession();
 if (session?.role !== "OWNER") throw new Error("権限がありません。");
 const name = String(form.get("name") ?? "").trim();
 const email = String(form.get("email") ?? "").trim();
 const password = String(form.get("password") ?? "");
 if (!name || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12 || password.length > 128) {
  redirect("/accountant-settings?error=invalid");
 }
 const passwordHash = await bcrypt.hash(password, 12);
 try {
  await prisma.staff.create({ data: { name, email, passwordHash, role: "ACCOUNTANT", title: "税理士・閲覧専用", storeId: null } });
 } catch (error) {
  if ((error as { code?: string }).code === "P2002") redirect("/accountant-settings?error=duplicate");
  throw error;
 }
 redirect("/accountant-settings?created=1");
}
export async function revokeAccountant(form: FormData) {
 const session = await requireSession();
 if (session?.role !== "OWNER") throw new Error("権限がありません。");
 const id = String(form.get("id") ?? "");
 await prisma.staff.updateMany({ where: { id, role: "ACCOUNTANT", active: true }, data: { active: false } });
 redirect("/accountant-settings?revoked=1");
}
