import { prisma } from "@/lib/prisma";
import type { SessionData } from "@/lib/session";

/**
 * 表示範囲（店舗スコープ）を解決する。
 * オーナー・税理士以外は、URLのクエリを改ざんされても必ず自店舗のデータのみに固定する。
 */
export async function resolveStoreScope(session: SessionData, requestedSlug?: string) {
  if (session.role === "OWNER" || session.role === "ACCOUNTANT") {
    if (!requestedSlug) return { storeId: undefined, store: undefined };
    const store = await prisma.store.findUnique({ where: { slug: requestedSlug } });
    return { storeId: store?.id, store: store ?? undefined };
  }

  const store = await prisma.store.findUnique({ where: { id: session.storeId! } });
  return { storeId: session.storeId!, store: store ?? undefined };
}
