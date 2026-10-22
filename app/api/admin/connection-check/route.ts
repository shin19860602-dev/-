import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { checkDatabaseTarget, EXPECTED_PROJECT_REF } from "@/lib/dbConnectionCheck";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

const labels: Record<string, string> = {
  matches_candidate: "候補のSupabaseプロジェクトと一致しています",
  different_target: "候補とは異なる接続先です",
  missing: "設定されていません",
  invalid: "接続先の形式を確認できませんでした",
  unrecognized: "この形式では接続先を判定できませんでした",
};

function respond(request: Request, data: Record<string, string>, status = 200) {
  if (!request.headers.get("accept")?.includes("text/html")) {
    return Response.json(data, { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
  }
  const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const content = data.error
    ? `<p>${escape(data.error)}</p>${status === 401 ? '<p>このブラウザでオーナーとしてログインしてから、この確認ページに戻ってください。</p><p><a href="/login/owner">オーナーログインへ</a></p>' : ""}`
    : `<p>実行環境：${data.environment === "production" ? "本番" : "本番以外"}</p><p>通常接続：${escape(labels[data.databaseUrl] ?? "判定できませんでした")}</p><p>管理用接続：${escape(labels[data.directUrl] ?? "判定できませんでした")}</p><p>この画面の結果をチャットにお知らせください。</p>`;
  return new Response(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>接続先の確認</title></head><body><main><h1>接続先の確認</h1>${content}<p>パスワード・接続文字列は表示していません。データの変更も行っていません。</p></main></body></html>`, {
    status,
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'" },
  });
}

// Temporary, owner-only verification. No URL or credential is sent to the browser.
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return respond(request, { error: "ログインが必要です。" }, 401);
    if (session.role !== "OWNER") return respond(request, { error: "閲覧権限がありません。" }, 403);
    const staff = await prisma.staff.findUnique({ where: { id: session.staffId }, select: { role: true, active: true } });
    if (!staff?.active || staff.role !== "OWNER") return respond(request, { error: "閲覧権限がありません。" }, 403);
    return respond(request, {
      expectedProject: EXPECTED_PROJECT_REF,
      databaseUrl: checkDatabaseTarget(process.env.DATABASE_URL),
      directUrl: checkDatabaseTarget(process.env.DIRECT_URL),
      environment: process.env.VERCEL_ENV === "production" ? "production" : "non-production",
    });
  } catch {
    return respond(request, { error: "接続先を確認できませんでした。" }, 503);
  }
}
