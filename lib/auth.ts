import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type AuthResult =
  | { ok: true; staff: { id: string; storeId: string | null; role: string; name: string; title: string | null } }
  | { ok: false; reason: "locked" | "invalid" };

// 店舗を選んだ後、名前を選ばずPINだけでログインする。
// 入力されたPINをその店舗の全スタッフのPINハッシュと照合し、一致した本人としてログインする。
export async function verifyStorePin(storeId: string, pin: string): Promise<AuthResult> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return { ok: false, reason: "invalid" };

  if (store.pinLockedUntil && store.pinLockedUntil > new Date()) {
    return { ok: false, reason: "locked" };
  }

  const candidates = await prisma.staff.findMany({
    where: { storeId, active: true, role: { not: "OWNER" }, pinHash: { not: null } },
  });

  for (const staff of candidates) {
    const valid = await bcrypt.compare(pin, staff.pinHash!);
    if (valid) {
      await prisma.store.update({ where: { id: storeId }, data: { pinFailedAttempts: 0, pinLockedUntil: null } });
      return {
        ok: true,
        staff: { id: staff.id, storeId: staff.storeId, role: staff.role, name: staff.name, title: staff.title },
      };
    }
  }

  const attempts = store.pinFailedAttempts + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
  await prisma.store.update({
    where: { id: storeId },
    data: { pinFailedAttempts: attempts, pinLockedUntil: lockedUntil },
  });
  return { ok: false, reason: lockedUntil ? "locked" : "invalid" };
}

export async function verifyOwnerPassword(email: string, password: string): Promise<AuthResult> {
  const staff = await prisma.staff.findUnique({ where: { email } });
  if (!staff || !staff.active || staff.role !== "OWNER" || !staff.passwordHash) {
    return { ok: false, reason: "invalid" };
  }

  if (staff.lockedUntil && staff.lockedUntil > new Date()) {
    return { ok: false, reason: "locked" };
  }

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) {
    const attempts = staff.failedAttempts + 1;
    const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await prisma.staff.update({
      where: { id: staff.id },
      data: { failedAttempts: attempts, lockedUntil },
    });
    return { ok: false, reason: lockedUntil ? "locked" : "invalid" };
  }

  await prisma.staff.update({
    where: { id: staff.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  return {
    ok: true,
    staff: { id: staff.id, storeId: staff.storeId, role: staff.role, name: staff.name, title: staff.title },
  };
}
