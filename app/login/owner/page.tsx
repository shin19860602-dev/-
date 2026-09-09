import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import OwnerForm from "./OwnerForm";

export default async function OwnerLoginPage() {
  const session = await requireSession();
  if (session) redirect("/sales");

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <a className="back-link" href="/">
          ← 店舗選択に戻る
        </a>
        <div className="auth-brand">
          <div className="brand-mark">貝</div>
          <div className="brand-sub">オーナーログイン</div>
        </div>
        <OwnerForm />
      </div>
    </div>
  );
}
