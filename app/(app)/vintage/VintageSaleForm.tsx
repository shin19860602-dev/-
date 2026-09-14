"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVintageSale } from "./actions";
import { sanitizeAmountInput } from "@/lib/format";

export default function VintageSaleForm({
  storeId,
  categories,
  brands,
}: {
  storeId: string;
  categories: string[];
  brands: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-title">売上を登録</div>
      {error && <div className="auth-error">{error}</div>}
      {justSaved && (
        <div className="card-sub" style={{ color: "var(--good)", fontWeight: 700 }}>
          登録しました。続けて次の商品を入力できます。
        </div>
      )}
      <form
        ref={formRef}
        action={(formData) => {
          setError(null);
          setJustSaved(false);
          startTransition(async () => {
            const result = await createVintageSale(formData);
            if (result.ok) {
              formRef.current?.reset();
              setCategory(null);
              setBrand(null);
              setPaymentMethod("cash");
              setFormKey((k) => k + 1);
              setJustSaved(true);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <input type="hidden" name="storeId" value={storeId} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">日付</label>
            <input key={formKey} className="field-input" type="date" name="date" defaultValue={defaultDate} required style={{ maxWidth: 200 }} />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">分類（任意）</label>
            <input type="hidden" name="category" value={category ?? ""} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={category === c ? "btn-primary" : "btn-ghost"}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => setCategory((cur) => (cur === c ? null : c))}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">ブランド（任意）</label>
            <input type="hidden" name="brand" value={brand ?? ""} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={brand === b ? "btn-primary" : "btn-ghost"}
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={() => setBrand((cur) => (cur === b ? null : b))}
                >
                  {b}
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

        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <div style={{ marginBottom: 12 }}>
          <label className="form-label">お支払い方法</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={paymentMethod === "cash" ? "btn-primary" : "btn-ghost"}
              onClick={() => setPaymentMethod("cash")}
              style={{ flex: 1 }}
            >
              現金
            </button>
            <button
              type="button"
              className={paymentMethod === "credit" ? "btn-primary" : "btn-ghost"}
              onClick={() => setPaymentMethod("credit")}
              style={{ flex: 1 }}
            >
              クレジット
            </button>
          </div>
        </div>

        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "登録中…" : "登録する"}
        </button>
      </form>
    </div>
  );
}
