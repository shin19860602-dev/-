"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPayrollPassword } from "./actions";

export default function PayrollPasswordForm({ storeId, storeName, isSet }: { storeId: string; storeName: string; isSet: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="list-row" style={{ flexWrap: "wrap", gap: 8 }}>
      <div className="grow">
        <div className="title">{storeName}</div>
        <div className="meta">閲覧用パスワード：{isSet ? "設定済み" : "未設定"}</div>
      </div>
      {open ? (
        <form
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await setPayrollPassword(formData);
              if (result.ok) {
                setOpen(false);
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <input type="hidden" name="storeId" value={storeId} />
          <input className="field-input" type="password" name="password" placeholder="新しいパスワード（4文字以上）" required style={{ width: 200 }} />
          <button className="btn-primary" type="submit" disabled={pending} style={{ padding: "5px 12px", fontSize: 11.5 }}>
            {pending ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "5px 12px", fontSize: 11.5 }}
            disabled={pending}
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
          >
            キャンセル
          </button>
          {error && (
            <div className="auth-error" style={{ flexBasis: "100%" }}>
              {error}
            </div>
          )}
        </form>
      ) : (
        <button type="button" className="btn-ghost" style={{ padding: "5px 12px", fontSize: 11.5 }} onClick={() => setOpen(true)}>
          {isSet ? "変更" : "設定"}
        </button>
      )}
    </div>
  );
}
