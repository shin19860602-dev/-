import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { checkDatabaseTarget, EXPECTED_PROJECT_REF } from "@/lib/dbConnectionCheck";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

// Temporary, owner-only verification. No URL or credential is sent to the browser.
export async function GET() {
  try {
    const session = await requireSession();
    if (!session) return Response.json({ error: "ログインが必要です。" }, { status: 401, headers });
    if (session.role !== "OWNER") return Response.json({ error: "閲覧権限がありません。" }, { status: 403, headers });
    const staff = await prisma.staff.findUnique({ where: { id: session.staffId }, select: { role: true, active: true } });
    if (!staff?.active || staff.role !== "OWNER") return Response.json({ error: "閲覧権限がありません。" }, { status: 403, headers });
    return Response.json({
      expectedProject: EXPECTED_PROJECT_REF,
      databaseUrl: checkDatabaseTarget(process.env.DATABASE_URL),
      directUrl: checkDatabaseTarget(process.env.DIRECT_URL),
      environment: process.env.VERCEL_ENV === "production" ? "production" : "non-production",
    }, { headers });
  } catch {
    return Response.json({ error: "接続先を確認できませんでした。" }, { status: 503, headers });
  }
}
