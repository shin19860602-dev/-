"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setInsuranceRate } from "./actions";

export default function InsuranceRateForm({ storeId, storeName, rate }: { storeId: string; storeName: string; rate: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="list-row" style={{ flexWrap: "wrap", gap: 8 }}>
      <div className="grow">
        <div className="title">{storeName}</div>
        <div className="meta">雇用保険料率（労働者負担分）：{rate > 0 ? `${rate}%` : "未設定"}</div>
      </div>
      {open ? (
        <form
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await setInsuranceRate(formData);
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
          <input
            className="field-input"
            type="text"
            inputMode="decimal"
            name="insuranceRate"
            defaultValue={rate > 0 ? rate : 0.5}
            placeholder="料率（%）"
            style={{ width: 110 }}
          />
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
          {rate > 0 ? "変更" : "設定"}
        </button>
      )}
    </div>
  );
}
