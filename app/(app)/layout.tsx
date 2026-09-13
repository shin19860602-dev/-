import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import StoreFilter from "./StoreFilter";
import NavLinks from "./NavLinks";
import LogoutButton from "./LogoutButton";
import { givenNameInitial as initial } from "@/lib/format";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (!session) redirect("/");

  const isOwner = session.role === "OWNER";
  // 「全店舗」は美容部門（SALON/LASH）のみを指す。古着部門（VINTAGE）は完全に別画面で扱う。
  const allStoresForLayout = await prisma.store.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true, name: true, colorKey: true, kind: true },
  });
  const stores = isOwner ? allStoresForLayout.filter((s) => s.kind !== "VINTAGE") : [];
  const isVintageStaff = !isOwner && allStoresForLayout.find((s) => s.id === session.storeId)?.kind === "VINTAGE";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">貝</span>
          <span className="brand-sub">kaichan no SALON System</span>
        </div>

        {isOwner ? (
          <StoreFilter stores={stores} />
        ) : (
          <div className="side-block-label" style={{ padding: "0 10px" }}>
            表示店舗：<strong style={{ color: "var(--sidebar-text)" }}>{session.name ? "自店舗のみ" : ""}</strong>
          </div>
        )}

        <NavLinks isOwner={isOwner} showVintage={isOwner || isVintageStaff} />

        <div className="sidebar-spacer" />
        <div className="owner-card">
          <div className="avatar">{initial(session.name ?? "")}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="owner-name">{session.name}</div>
            <div className="owner-role">
              {isOwner ? "オーナー・全権限" : session.title}
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main>{children}</main>
    </div>
  );
}
