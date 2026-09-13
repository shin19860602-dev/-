import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { monthBounds } from "@/lib/analytics";
import Topbar from "../Topbar";
import VintageTabs from "./VintageTabs";
import VintageSaleForm from "./VintageSaleForm";
import VintageSalesTable from "./VintageSalesTable";
import { resolveVintageAccess } from "./access";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

export default async function VintagePage() {
  const access = await resolveVintageAccess();
  if (!access.session) redirect("/");
  const { session, store, hasAccess } = access;

  if (!store || !hasAccess) {
    return (
      <>
        <Topbar title="古着倉庫KUJEKUJE" scopeLabel="-" roleLabel={ROLE_LABEL[session.role!]} />
        <div className="view">
          <div className="card card-pad">
            <div className="card-title">閲覧権限がありません</div>
            <div className="card-sub">この画面は古着倉庫KUJEKUJEのスタッフとオーナーのみが利用できます。</div>
          </div>
        </div>
      </>
    );
  }

  const now = new Date();
  const thisMonth = monthBounds(now, 0);

  const [monthSales, tags] = await Promise.all([
    prisma.vintageSale.findMany({
      where: { storeId: store.id, date: { gte: thisMonth.start, lt: thisMonth.end } },
      include: { staff: true },
      orderBy: { date: "desc" },
    }),
    prisma.vintageTag.findMany({ where: { storeId: store.id, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  const categories = tags.filter((t) => t.kind === "category").map((t) => t.name);
  const brands = tags.filter((t) => t.kind === "brand").map((t) => t.name);

  return (
    <>
      <Topbar title="古着倉庫KUJEKUJE" scopeLabel="古着部門" roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <VintageTabs />
        <VintageSaleForm storeId={store.id} categories={categories} brands={brands} />

        <div className="card card-pad" style={{ marginTop: 0 }}>
          <div className="card-title">売上履歴（今月）</div>
          <VintageSalesTable sales={monthSales} canEdit={true} categories={categories} brands={brands} />
        </div>
      </div>
    </>
  );
}
