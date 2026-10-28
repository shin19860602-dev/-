import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { aggregateMonthlySales, monthlyExportScope, parseSalesMonth } from "@/lib/monthlySalesReport";
import { monthlySalesWorkbook } from "@/lib/monthlySalesWorkbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const errorResponse = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.staffId) return errorResponse("ログインしてからExcelを出力してください。", 401);
    // Use current DB permissions, rather than trusting an older role in the cookie.
    const actor = await prisma.staff.findUnique({ where: { id: session.staffId }, select: { role: true, storeId: true, active: true } });
    if (!actor?.active) return errorResponse("ログインし直してください。", 401);
    const params = new URL(request.url).searchParams;
    const month = parseSalesMonth(params.get("month") ?? "");
    if (!month) return errorResponse("出力する年月を正しく選択してください。", 400);
    if (actor.role !== "OWNER" && !actor.storeId) return errorResponse("出力できる店舗がありません。", 403);
    const stores = await prisma.store.findMany({
      where: { kind: { in: ["SALON", "LASH"] }, ...(actor.role === "OWNER" ? {} : { id: actor.storeId! }) },
      select: { id: true, slug: true, name: true, kind: true },
    });
    const scope = monthlyExportScope(actor, stores, params.get("store"));
    if (!scope) return errorResponse("指定した店舗のExcelは出力できません。", 403);
    const where = { storeId: { in: scope.storeIds }, date: { gte: month.start, lt: month.end } };
    // A consistent snapshot keeps sales and expenses in the same export transaction.
    const [visits, expenses] = await prisma.$transaction([
      prisma.visit.findMany({ where, select: { date: true, amount: true, productAmount: true, pointAmount: true, paymentMethod: true } }),
      prisma.expense.findMany({ where, select: { date: true, amount: true } }),
    ], { isolationLevel: "RepeatableRead" });
    const bytes = await monthlySalesWorkbook(month, scope.label, aggregateMonthlySales(month, visits, expenses));
    const filename = `${month.value}_${scope.label}_日別売上・経費.xlsx`;
    return new Response(bytes, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="monthly-sales-${month.value}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return errorResponse("Excelを作成できませんでした。時間をおいて、もう一度お試しください。", 500);
  }
}
