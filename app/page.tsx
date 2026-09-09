import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function LoginEntryPage() {
  const session = await requireSession();
  if (session) redirect("/sales");

  const stores = await prisma.store.findMany({ orderBy: { createdAt: "asc" } });
  const colorVar = (k: string) => `var(--store-${k})`;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">貝</div>
          <div className="brand-sub">kaichan no SALON System</div>
        </div>
        <div className="form-label" style={{ textAlign: "center", marginBottom: 14 }}>
          ご自身の店舗を選んでください
        </div>
        <div className="auth-store-list">
          {stores.map((s) => (
            <a key={s.id} className="auth-store-btn" href={`/login/${s.slug}`}>
              <span className="dot" style={{ background: colorVar(s.colorKey), width: 11, height: 11 }} />
              {s.name}
            </a>
          ))}
        </div>
        <a className="auth-owner-link" href="/login/owner">
          オーナーとしてログイン
        </a>
      </div>
    </div>
  );
}
