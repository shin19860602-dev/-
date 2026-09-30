"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBankDeposit } from "./bankActions";
import { sanitizeAmountInput } from "@/lib/format";

export default function NewBankDepositForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-title">銀行に入金を記録</div>
      <div className="card-sub">チュラ：reの現金を銀行へ入金したら、その都度ここに記録する（現金残高から差し引かれる）</div>
      {error && <div className="auth-error">{error}</div>}
      {justSaved && (
        <div className="card-sub" style={{ color: "var(--good)", fontWeight: 700 }}>
          登録しました。
        </div>
      )}
      <form
        ref={formRef}
        action={(formData) => {
          setError(null);
          setJustSaved(false);
          startTransition(async () => {
            const result = await createBankDeposit(formData);
            if (result.ok) {
              formRef.current?.reset();
              setFormKey((k) => k + 1);
              setJustSaved(true);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">日付</label>
            <input key={formKey} className="field-input" type="date" name="date" defaultValue={defaultDate} required style={{ maxWidth: 200 }} />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">金額（円）</label>
            <input
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="amount"
              required
              onChange={sanitizeAmountInput}
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">メモ（任意）</label>
            <input className="field-input" name="memo" />
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "登録中…" : "登録する"}
        </button>
      </form>
    </div>
  );
}
