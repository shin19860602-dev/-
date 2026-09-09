import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveStoreScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { givenNameInitial as initial } from "@/lib/format";
import Topbar from "../Topbar";
import KarteSearch from "./KarteSearch";
import NewCustomerForm from "./NewCustomerForm";
import CustomerDetailPanel from "./CustomerDetailPanel";

const ROLE_LABEL: Record<string, string> = { OWNER: "オーナー全権限", MANAGER: "マネージャー権限", STAFF: "スタッフ権限" };

const dateLabel = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

export default async function KartePage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string; q?: string; customer?: string }>;
}) {
  const session = await requireSession();
  if (!session) redirect("/");

  const sp = await searchParams;
  const { storeId, store } = await resolveStoreScope(session, sp.store);
  const scopeLabel = store ? store.name : "全店舗";

  const customers = await prisma.customer.findMany({
    where: {
      storeId: storeId ?? undefined,
      active: true,
      name: sp.q ? { contains: sp.q } : undefined,
    },
    include: { store: true, visits: { select: { date: true }, orderBy: { date: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  const selectedId = sp.customer && customers.some((c) => c.id === sp.customer) ? sp.customer : customers[0]?.id;
  const selected = selectedId
    ? await prisma.customer.findUnique({
        where: { id: selectedId },
        include: {
          store: true,
          primaryStaff: true,
          visits: { orderBy: { date: "desc" }, include: { staff: true } },
        },
      })
    : null;

  const [allStores, allStaff] = await Promise.all([
    prisma.store.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.staff.findMany({ where: { storeId: storeId ?? undefined, active: true, role: { not: "OWNER" } }, orderBy: { name: "asc" } }),
  ]);

  const qsBase = new URLSearchParams();
  if (sp.store) qsBase.set("store", sp.store);
  if (sp.q) qsBase.set("q", sp.q);

  const customerHref = (id: string) => {
    const p = new URLSearchParams(qsBase);
    p.set("customer", id);
    return `?${p.toString()}`;
  };

  const staffOptionsForEdit = allStaff.map((s) => ({ id: s.id, name: s.name, title: s.title }));

  return (
    <>
      <Topbar title="カルテ" scopeLabel={scopeLabel} roleLabel={ROLE_LABEL[session.role!]} />
      <div className="view">
        <div className="karte-layout">
          <div className="card card-pad">
            <KarteSearch />
            <NewCustomerForm
              isOwner={session.role === "OWNER"}
              fixedStoreId={storeId}
              stores={allStores.map((s) => ({ id: s.id, name: s.name }))}
              staff={allStaff.map((s) => ({ id: s.id, name: s.name, storeId: s.storeId, title: s.title }))}
            />
            <div>
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
            <CustomerDetailPanel customer={selected} staffOptions={staffOptionsForEdit} />
          ) : (
            <div className="card card-pad">
              <div className="card-sub">お客様を選択、または新規登録してください。</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
