"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlockPayroll } from "./actions";

export default function PayrollPasswordGate({ storeId }: { storeId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card card-pad">
      <div className="card-title">給料の閲覧にはパスワードが必要です</div>
      <div className="card-sub">オーナーに設定してもらったパスワードを入力してください。</div>
      {error && <div className="auth-error">{error}</div>}
      <form
        style={{ display: "flex", gap: 8, marginTop: 4 }}
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await unlockPayroll(formData);
            if (result.ok) {
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <input type="hidden" name="storeId" value={storeId} />
        <input className="field-input" type="password" name="password" placeholder="パスワード" required style={{ flex: 1, maxWidth: 240 }} />
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "確認中…" : "閲覧する"}
        </button>
      </form>
    </div>
  );
}
