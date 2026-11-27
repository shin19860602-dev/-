import { redirect } from "next/navigation";
import { requireSession, homePathForSession } from "@/lib/session";
import AccountantForm from "./AccountantForm";

export default async function AccountantLoginPage() {
  const session = await requireSession({ allowAccountant: true });
  if (session) redirect(await homePathForSession(session));

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <a className="back-link" href="/">
          ← 店舗選択に戻る
        </a>
        <div className="auth-brand">
          <div className="brand-mark">貝</div>
          <div className="brand-sub">税理士ログイン（閲覧専用）</div>
        </div>
        <AccountantForm />
      </div>
    </div>
  );
}
