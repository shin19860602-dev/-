"use server";

import { redirect } from "next/navigation";
import { verifyStorePin, verifyOwnerPassword, verifyAccountantPassword } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function submitPin(storeId: string, pin: string) {
  const result = await verifyStorePin(storeId, pin);
  if (!result.ok) {
    return { ok: false as const, reason: result.reason };
  }

  const session = await getSession();
  session.staffId = result.staff.id;
  session.storeId = result.staff.storeId;
  session.role = result.staff.role as "MANAGER" | "STAFF";
  session.name = result.staff.name;
  session.title = result.staff.title;
  delete session.payrollUnlockedStoreId;
  delete session.savingsUnlockedStoreId;
  await session.save();

  return { ok: true as const };
}

export async function submitOwnerLogin(email: string, password: string) {
  const result = await verifyOwnerPassword(email, password);
  if (!result.ok) {
    return { ok: false as const, reason: result.reason };
  }

  const session = await getSession();
  session.staffId = result.staff.id;
  session.storeId = result.staff.storeId;
  session.role = "OWNER";
  session.name = result.staff.name;
  session.title = result.staff.title;
  delete session.payrollUnlockedStoreId;
  delete session.savingsUnlockedStoreId;
  await session.save();

  return { ok: true as const };
}

export async function submitAccountantLogin(email: string, password: string) {
 const result = await verifyAccountantPassword(email.trim(), password);
 if (!result.ok) return { ok: false as const, reason: result.reason };
 const session = await getSession();
 session.staffId = result.staff.id; session.storeId = null; session.role = "ACCOUNTANT";
 session.name = result.staff.name; session.title = "リベ大・閲覧専用";
 delete session.payrollUnlockedStoreId; delete session.savingsUnlockedStoreId;
 await session.save(); return { ok: true as const };
}
export async function logout() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
