import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import Topbar from "../Topbar";
import SettingsTabs from "../SettingsTabs";
import MenuItemRow from "./MenuItemRow";
import AddMenuItemForm from "./AddMenuItemForm";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ store?: string }> }) {
  const session = await requireSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";

  const stores = await prisma.store.findMany({
    where: storeId ? { id: storeId } : undefined,
    orderBy: { createdAt: "asc" },
    include: { menuItems: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <>
      <Topbar title="設定・メニュー" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <SettingsTabs />

        {stores.map((s) => {
          const canEdit = session.role === "OWNER" || (session.role === "MANAGER" && session.storeId === s.id);
          const services = s.menuItems.filter((m) => m.type === "service");
          const products = s.menuItems.filter((m) => m.type === "product");

          return (
            <div key={s.id} style={{ marginBottom: 24 }}>
              {!storeId && (
                <div className="card-title" style={{ marginBottom: 10 }}>
                  <span className={`badge badge-store-${s.colorKey}`}>{s.name}</span>
                </div>
              )}
              <div className="grid-2">
                <div className="card card-pad">
                  <div className="card-title">施術メニュー</div>
                  <div className="card-sub">売上登録画面のプルダウンに表示されます</div>
                  <div>
                    {services.map((m, i) => (
                      <MenuItemRow
                        key={m.id}
                        id={m.id}
                        name={m.name}
                        price={m.price}
                        active={m.active}
                        canEdit={canEdit}
                        isFirst={i === 0}
                        isLast={i === services.length - 1}
                      />
                    ))}
                    {services.length === 0 && <div className="card-sub">まだメニューがありません。</div>}
                  </div>
                  {canEdit && <AddMenuItemForm storeId={s.id} type="service" />}
                </div>

                <div className="card card-pad">
                  <div className="card-title">店販商品</div>
                  <div className="card-sub">売上登録画面の店販プルダウンに表示されます</div>
                  <div>
                    {products.map((m, i) => (
                      <MenuItemRow
                        key={m.id}
                        id={m.id}
                        name={m.name}
                        price={m.price}
                        active={m.active}
                        canEdit={canEdit}
                        isFirst={i === 0}
                        isLast={i === products.length - 1}
                      />
                    ))}
                    {products.length === 0 && <div className="card-sub">まだ商品がありません。</div>}
                  </div>
                  {canEdit && <AddMenuItemForm storeId={s.id} type="product" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
