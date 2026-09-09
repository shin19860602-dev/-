import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { prisma } from "@/lib/prisma";

export type Role = "OWNER" | "MANAGER" | "STAFF";

export interface SessionData {
  staffId?: string;
  storeId?: string | null;
  role?: Role;
  name?: string;
  title?: string | null;
}

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "irodori_session",
  cookieOptions: {
    // HTTPS配信になったら環境変数 COOKIE_SECURE=true を設定する。
    // 「本番ビルドかどうか」と「HTTPSで配信されているか」は別物なので、
    // NODE_ENV ではなくこの専用フラグで判定する（LAN上のHTTPでのテストではSecure Cookieが保存されないため）。
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: 60 * 60 * 12, // 12時間（店舗の営業時間を想定）
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session.staffId || !session.role) {
    return null;
  }

  // 開発中の再シード等でスタッフ／店舗IDが失効しているセッションは、
  // 中途半端な状態でページを壊すよりも、無効として扱いログイン画面に戻す。
  // Cookieの書き換え（destroy）はServer Action／Route Handlerでしかできないため、
  // ここ（ページ描画中）では行わない。古いCookieは次回ログイン成功時に上書きされる。
  const staff = await prisma.staff.findUnique({ where: { id: session.staffId } });
  if (!staff || !staff.active) {
    return null;
  }

  return session;
}
