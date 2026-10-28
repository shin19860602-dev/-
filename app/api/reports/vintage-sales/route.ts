import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { parseSalesMonth } from "@/lib/monthlySalesReport";
import { canExportVintage } from "@/lib/vintageSalesReport";
import { vintageSalesWorkbook } from "@/lib/vintageSalesWorkbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const errorResponse = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session.staffId) return errorResponse("ログインしてからExcelを出力してください。", 401);
    const actor = await prisma.staff.findUnique({ where: { id: session.staffId }, select: { role: true, storeId: true, active: true } });
    if (!actor?.active) return errorResponse("ログインし直してください。", 401);
    const month = parseSalesMonth(new URL(request.url).searchParams.get("month") ?? "");
    if (!month) return errorResponse("出力する年月を正しく選択してください。", 400);
    const store = await prisma.store.findFirst({ where: { kind: "VINTAGE" }, select: { id: true, kind: true, name: true } });
    if (!store || !canExportVintage(actor, store)) return errorResponse("古着部門のExcelを出力する権限がありません。", 403);
    const sales = await prisma.vintageSale.findMany({
      where: { storeId: store.id, date: { gte: month.start, lt: month.end } },
      select: { date: true, amount: true, paymentMethod: true },
    });
    const bytes = await vintageSalesWorkbook(month, store.name, sales);
    const filename = `${month.value}_KUJEKUJE_日別売上.xlsx`;
    return new Response(bytes, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="vintage-sales-${month.value}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return errorResponse("Excelを作成できませんでした。時間をおいて、もう一度お試しください。", 500); }
}
