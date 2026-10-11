import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { givenNameInitial as initial } from "@/lib/format";
import { jstParts } from "@/lib/date";
import { categoriesForStoreKind, SALON_CATEGORIES, LASH_CATEGORIES } from "@/lib/categories";
import { buildKarteWhere, type KarteFilters } from "@/lib/karteFilters";
import Topbar from "../Topbar";
import KarteSearch from "./KarteSearch";
import NewCustomerForm from "./NewCustomerForm";
import CustomerDetailPanel from "./CustomerDetailPanel";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

const dateLabel = (d: Date) => {
  const p = jstParts(d);
  return `${p.year}/${String(p.month + 1).padStart(2, "0")}/${String(p.date).padStart(2, "0")}`;
};

export default async function KartePage({
  searchParams,
}: {
  searchParams: Promise<KarteFilters>;
}) {
  const session = await requireSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";

  const { where, error } = buildKarteWhere(sp, storeId);
  const customers = error ? [] : await prisma.customer.findMany({
    where,
    include: { store: true, visits: { select: { date: true }, orderBy: { date: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  const selectedId = sp.customer || customers[0]?.id;
  const selected = selectedId
    ? await prisma.customer.findFirst({
        where: { id: selectedId, storeId: storeId ?? undefined },
        include: {
          store: true,
          primaryStaff: true,
          visits: { orderBy: { date: "desc" }, include: { staff: true } },
        },
      })
    : null;

  const [allStores, allStaff] = await Promise.all([
    prisma.store.findMany({ where: { kind: { not: "VINTAGE" } }, orderBy: { createdAt: "asc" } }),
    prisma.staff.findMany({ where: { storeId: storeId ?? undefined, active: true, role: { not: "OWNER" } }, orderBy: { name: "asc" } }),
  ]);

  const qsBase = new URLSearchParams();
  if (sp.store) qsBase.set("store", sp.store);
  for (const key of ["q", "gender", "category", "from", "to"] as const) {
    if (sp[key]) qsBase.set(key, sp[key]);
  }

  const customerHref = (id: string) => {
    const p = new URLSearchParams(qsBase);
    p.set("customer", id);
    return `?${p.toString()}`;
  };

  const categories = [...new Set(store ? categoriesForStoreKind(store.kind) : [...SALON_CATEGORIES, ...LASH_CATEGORIES])];

  const staffOptionsForEdit = allStaff.map((s) => ({ id: s.id, name: s.name, title: s.title }));

  return (
    <>
      <Topbar title="カルテ" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <div className="karte-layout">
          <div className="card card-pad">
            <KarteSearch categories={categories} />
            {error && <div className="auth-error" role="alert">{error}</div>}
            <div className="card-sub" role="status">検索結果：{customers.length}名</div>
            <NewCustomerForm
              isOwner={session.role === "OWNER"}
              fixedStoreId={storeId}
              stores={allStores.map((s) => ({ id: s.id, name: s.name }))}
              staff={allStaff.map((s) => ({ id: s.id, name: s.name, storeId: s.storeId, title: s.title }))}
            />
            <div className="cust-list">
              {customers.map((c) => (
                <a key={c.id} className={`cust-item${c.id === selectedId ? " active" : ""}`} href={customerHref(c.id)}>
                  <div className="mini-avatar" style={{ background: `var(--store-${c.store.colorKey})` }}>
                    {initial(c.name)}
                  </div>
                  <div className="grow">
                    <div className="name">{c.name} 様</div>
                    <div className="sub">
                      {c.store.name}・最終来店 {c.visits[0] ? dateLabel(c.visits[0].date) : "未来店"}
                    </div>
                  </div>
                  {c.allergyNote && <span className="warn-dot" title="アレルギー注意あり" />}
                </a>
              ))}
              {customers.length === 0 && <div className="card-sub" style={{ padding: 12 }}>該当するお客様が見つかりません。</div>}
            </div>
          </div>

          {selected ? (
            <CustomerDetailPanel key={selected.id} customer={selected} staffOptions={staffOptionsForEdit} />
          ) : (
            <div className="card card-pad">
              <div className="card-sub">{sp.customer ? "指定されたカルテが見つからないか、閲覧権限がありません。" : "お客様を選択、または新規登録してください。"}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
