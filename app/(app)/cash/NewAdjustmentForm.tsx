"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCashAdjustment } from "./adjustmentActions";
import { yen } from "@/lib/analytics";
import { sanitizeAmountInput } from "@/lib/format";

export default function NewAdjustmentForm({ currentBalance }: { currentBalance: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [enteredBalance, setEnteredBalance] = useState("");
  const [pending, startTransition] = useTransition();

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const enteredNum = Number(enteredBalance || "0");
  const diff = enteredBalance ? enteredNum - currentBalance : null;

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-title">実際の現金残高を入力（残高調整）</div>
      <div className="card-sub">
        数えた現金とシステム上の残高がズレているときに使う。現在の計算上の残高：<strong style={{ color: "var(--text)" }}>{yen(currentBalance)}</strong>
      </div>
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
            const result = await createCashAdjustment(formData);
            if (result.ok) {
              formRef.current?.reset();
              setEnteredBalance("");
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
            <label className="form-label">実際に数えた現金残高（円）</label>
            <input
              className="field-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              name="enteredBalance"
              required
              value={enteredBalance}
              onChange={(e) => {
                sanitizeAmountInput(e);
                setEnteredBalance(e.target.value);
              }}
            />
            {diff !== null && diff !== 0 && (
              <div className="card-sub" style={{ margin: "4px 0 0" }}>
                差額：{diff > 0 ? "＋" : ""}
                {yen(diff)}（この分が調整として記録されます）
              </div>
            )}
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">メモ（任意）</label>
            <input className="field-input" name="memo" placeholder="例：棚卸しで確認" />
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "登録中…" : "登録する"}
        </button>
      </form>
    </div>
  );
}
