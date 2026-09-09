import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import PinPad from "./PinPad";

export default async function StorePinPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const session = await requireSession();
  if (session) redirect("/sales");

  const { storeSlug } = await params;
  const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
  if (!store) notFound();

  const storeColor = `var(--store-${store.colorKey})`;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <a className="back-link" href="/">
          ← 店舗選択に戻る
        </a>
        <div className="auth-brand" style={{ marginBottom: 10 }}>
          <span className="badge" style={{ background: storeColor, color: "#fff" }}>
            {store.name}
          </span>
        </div>
        <div className="form-label" style={{ textAlign: "center", marginBottom: 6 }}>
          4桁のPINコードを入力してください
        </div>
        <PinPad storeId={store.id} />
      </div>
    </div>
  );
}
