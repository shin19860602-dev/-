"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStaff } from "./actions";

type Store = { id: string; name: string };

export default function NewStaffForm({
  isOwner,
  fixedStoreId,
  stores,
}: {
  isOwner: boolean;
  fixedStoreId?: string;
  stores: Store[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)} type="button" style={{ marginBottom: 16 }}>
        ＋ 新しいスタッフを追加
      </button>
    );
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-title">新しいスタッフを追加</div>
      <div className="card-sub">初回ログイン用の4桁PINを設定してください。ご本人に直接お伝えください。</div>
      {error && <div className="auth-error">{error}</div>}
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await createStaff(formData);
            if (result.ok) {
              setOpen(false);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
          {isOwner && !fixedStoreId ? (
            <div>
              <label className="form-label">店舗</label>
              <select className="field-select" name="storeId" defaultValue={stores[0]?.id}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="storeId" value={fixedStoreId} />
          )}
          <div>
            <label className="form-label">お名前</label>
            <input className="field-input" name="name" required />
          </div>
          <div>
            <label className="form-label">肩書き</label>
            <input className="field-input" name="title" placeholder="例：スタイリスト・アイリスト" required />
          </div>
          <div>
            <label className="form-label">権限</label>
            <select className="field-select" name="role" defaultValue="STAFF">
              <option value="STAFF">スタッフ権限</option>
              <option value="MANAGER">マネージャー権限（店長）</option>
            </select>
          </div>
          <div>
            <label className="form-label">入社日</label>
            <input className="field-input" type="date" name="hireDate" />
          </div>
          <div>
            <label className="form-label">4桁PINコード</label>
            <input className="field-input" name="pin" inputMode="numeric" pattern="\d{4}" maxLength={4} placeholder="例：1234" required />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? "登録中…" : "登録する"}
          </button>
          <button className="btn-ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
