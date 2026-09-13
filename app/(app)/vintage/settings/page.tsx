import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Topbar from "../../Topbar";
import NewStaffForm from "../../staff/NewStaffForm";
import StaffToggleButton from "../../staff/StaffToggleButton";
import VintageTabs from "../VintageTabs";
import VintageTagRow from "../VintageTagRow";
import AddVintageTagForm from "../AddVintageTagForm";
import { resolveVintageAccess } from "../access";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

export default async function VintageSettingsPage() {
  const access = await resolveVintageAccess();
  if (!access.session) redirect("/");
  const { session, store, hasAccess, isOwner } = access;

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

  const canManage = session.role === "OWNER" || session.role === "MANAGER";

  const [tags, staffList] = await Promise.all([
    prisma.vintageTag.findMany({ where: { storeId: store.id }, orderBy: { sortOrder: "asc" } }),
    prisma.staff.findMany({
      where: { storeId: store.id, role: { not: "OWNER" } },
      orderBy: [{ active: "desc" }, { role: "asc" }, { hireDate: "asc" }],
    }),
  ]);

  const categories = tags.filter((t) => t.kind === "category");
  const brands = tags.filter((t) => t.kind === "brand");

  return (
    <>
      <Topbar title="古着倉庫KUJEKUJE" scopeLabel="古着部門" roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <VintageTabs />

        <div className="grid-2">
          <div className="card card-pad">
            <div className="card-title">分類</div>
            <div className="card-sub">売上登録画面のボタンに表示されます</div>
            <div>
              {categories.map((t, i) => (
                <VintageTagRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  active={t.active}
                  canEdit={canManage}
                  isFirst={i === 0}
                  isLast={i === categories.length - 1}
                />
              ))}
              {categories.length === 0 && <div className="card-sub">まだ分類がありません。</div>}
            </div>
            {canManage && <AddVintageTagForm storeId={store.id} kind="category" />}
          </div>

          <div className="card card-pad">
            <div className="card-title">ブランド</div>
            <div className="card-sub">売上登録画面のボタンに表示されます</div>
            <div>
              {brands.map((t, i) => (
                <VintageTagRow
                  key={t.id}
                  id={t.id}
                  name={t.name}
                  active={t.active}
                  canEdit={canManage}
                  isFirst={i === 0}
                  isLast={i === brands.length - 1}
                />
              ))}
              {brands.length === 0 && <div className="card-sub">まだブランドがありません。</div>}
            </div>
            {canManage && <AddVintageTagForm storeId={store.id} kind="brand" />}
          </div>
        </div>

        {canManage && (
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <div className="card-title">スタッフ管理</div>
            <NewStaffForm isOwner={isOwner} fixedStoreId={store.id} stores={[{ id: store.id, name: store.name }]} />
            {staffList.map((s) => (
              <div className="list-row" key={s.id}>
                <div className="grow">
                  <div className="title" style={{ opacity: s.active ? 1 : 0.5 }}>
                    {s.name}
                    {!s.active && (
                      <span className="card-sub" style={{ margin: 0, marginLeft: 6 }}>
                        （退職・非表示）
                      </span>
                    )}
                  </div>
                  <div className="meta">{s.title}</div>
                </div>
                <StaffToggleButton id={s.id} active={s.active} />
              </div>
            ))}
            {staffList.length === 0 && <div className="card-sub">まだスタッフが登録されていません。</div>}
          </div>
        )}
      </div>
    </>
  );
}
