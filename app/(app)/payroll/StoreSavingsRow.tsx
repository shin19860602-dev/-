"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStoreSavings } from "./actions";
import { yen } from "@/lib/analytics";
import { sanitizeAmountInput } from "@/lib/format";

export default function StoreSavingsRow({
  storeId,
  storeName,
  yearMonth,
  amount,
  memo,
  canEdit,
}: {
  storeId: string;
  storeName: string;
  yearMonth: string;
  amount: number;
  memo: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  if (editing && canEdit) {
    return (
      <form
        className="list-row"
        style={{ flexWrap: "wrap", gap: 8 }}
        action={(formData) => {
          setError(null);
          startSave(async () => {
            const result = await saveStoreSavings(formData);
            if (result.ok) {
              setEditing(false);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <input type="hidden" name="storeId" value={storeId} />
        <input type="hidden" name="yearMonth" value={yearMonth} />
        <div className="grow" style={{ minWidth: 140 }}>
          <div className="title">{storeName}</div>
        </div>
        <input
          className="field-input"
          name="amount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={amount || ""}
          placeholder="積立額"
          style={{ width: 120 }}
          onChange={sanitizeAmountInput}
        />
        <input className="field-input" name="memo" defaultValue={memo} placeholder="メモ（任意）" style={{ flex: "1 1 160px" }} />
        <button className="btn-primary" type="submit" disabled={saving} style={{ padding: "5px 12px", fontSize: 11.5 }}>
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "5px 12px", fontSize: 11.5 }}
          disabled={saving}
          onClick={() => {
            setError(null);
            setEditing(false);
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
    );
  }

  return (
    <div className="list-row">
      <div className="grow">
        <div className="title">{storeName}</div>
        <div className="meta">
          {yen(amount)}
          {memo ? `・${memo}` : ""}
        </div>
      </div>
      {canEdit && (
        <button type="button" className="btn-ghost" style={{ padding: "5px 12px", fontSize: 11.5 }} onClick={() => setEditing(true)}>
          {amount ? "編集" : "登録"}
        </button>
      )}
    </div>
  );
}
