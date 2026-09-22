"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExpense, EXPENSE_CATEGORIES } from "./expenseActions";
import { sanitizeAmountInput } from "@/lib/format";

type Store = { id: string; name: string };

export default function NewExpenseForm({
  isOwner,
  fixedStoreId,
  stores,
}: {
  isOwner: boolean;
  fixedStoreId?: string;
  stores: Store[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [storeId, setStoreId] = useState(fixedStoreId ?? stores[0]?.id ?? "");
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>(EXPENSE_CATEGORIES[0]);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-title">経費を登録</div>
      {error && <div className="auth-error">{error}</div>}
      {justSaved && (
        <div className="card-sub" style={{ color: "var(--good)", fontWeight: 700 }}>
          登録しました。続けて次の経費を入力できます。
        </div>
      )}
      <form
        ref={formRef}
        action={(formData) => {
          setError(null);
          setJustSaved(false);
          startTransition(async () => {
            const result = await createExpense(formData);
            if (result.ok) {
              formRef.current?.reset();
              setCategory(EXPENSE_CATEGORIES[0]);
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
          {isOwner && !fixedStoreId ? (
            <div style={{ gridColumn: "span 2" }}>
              <label className="form-label">店舗</label>
              <select className="field-select" name="storeId" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="storeId" value={storeId} />
          )}

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">日付</label>
            <input key={formKey} className="field-input" type="date" name="date" defaultValue={defaultDate} required style={{ maxWidth: 200 }} />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">分類</label>
            <input type="hidden" name="category" value={category} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={category === c ? "btn-primary" : "btn-ghost"}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
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
