import { requireSession, type SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Store } from "@prisma/client";

// 古着部門（KUJEKUJE）の各画面で共通のアクセス判定。
// オーナー、またはこの店舗に所属するスタッフだけが利用できる。
export async function resolveVintageAccess(): Promise<
  { session: SessionData; store: Store | null; hasAccess: boolean; isOwner: boolean } | { session: null }
> {
  const session = await requireSession();
  if (!session) return { session: null };

  const store = await prisma.store.findFirst({ where: { kind: "VINTAGE" } });
  const isOwner = session.role === "OWNER";
  const hasAccess = isOwner || (!!store && session.storeId === store.id);

  return { session, store, hasAccess, isOwner };
}
