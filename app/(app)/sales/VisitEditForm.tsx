"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVisit } from "./actions";
import { sanitizeAmountInput } from "@/lib/format";
import { categoriesForStoreKind } from "@/lib/categories";
import { jstParts } from "@/lib/date";

const toDateInput = (date: Date) => {
  const p = jstParts(date);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.date).padStart(2, "0")}`;
};

type EditableVisit = {
  id: string;
  date: Date;
  menuName: string;
  amount: number;
  category: string | null;
  productName: string | null;
  productAmount: number | null;
  pointAmount: number | null;
  paymentMethod: string | null;
  memo: string | null;
};

export default function VisitEditForm({ visit, storeKind, onDone }: { visit: EditableVisit; storeKind: string; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>(visit.paymentMethod ?? "cash");
  const [category, setCategory] = useState<string | null>(visit.category);
  const [pending, startTransition] = useTransition();
  const categoryOptions = categoriesForStoreKind(storeKind);

  return (
    <form
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, padding: "10px 0" }}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await updateVisit(formData);
          if (result.ok) {
            onDone();
            router.refresh();
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <input type="hidden" name="visitId" value={visit.id} />
      <div>
        <label className="form-label">日付</label>
        <input className="field-input" name="date" type="date" defaultValue={toDateInput(visit.date)} required />
      </div>
      <div>
        <label className="form-label">施術内容（店販のみの場合は空欄でOK）</label>
        <input className="field-input" name="menuName" defaultValue={visit.menuName} />
      </div>
      <div>
        <label className="form-label">技術売上（円）</label>
        <input
          className="field-input"
          name="amount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={visit.amount || ""}
          onChange={sanitizeAmountInput}
        />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="form-label">分類（任意・集計に使用）</label>
        <input type="hidden" name="category" value={category ?? ""} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {categoryOptions.map((c) => (
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
      <div>
        <label className="form-label">ポイント売上（任意）</label>
        <input
          className="field-input"
          name="pointAmount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={visit.pointAmount ?? ""}
          onChange={sanitizeAmountInput}
        />
      </div>
      <div>
        <label className="form-label">店販商品名（任意）</label>
        <input className="field-input" name="productName" defaultValue={visit.productName ?? ""} />
      </div>
      <div>
        <label className="form-label">店販金額（任意）</label>
        <input
          className="field-input"
          name="productAmount"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={visit.productAmount ?? ""}
          onChange={sanitizeAmountInput}
        />
      </div>
      <div>
        <label className="form-label">お支払い方法</label>
        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className={paymentMethod === "cash" ? "btn-primary" : "btn-ghost"}
            style={{ flex: 1, padding: "6px 8px", fontSize: 12 }}
            onClick={() => setPaymentMethod("cash")}
          >
            現金
          </button>
          <button
            type="button"
            className={paymentMethod === "credit" ? "btn-primary" : "btn-ghost"}
            style={{ flex: 1, padding: "6px 8px", fontSize: 12 }}
            onClick={() => setPaymentMethod("credit")}
          >
            クレジット
          </button>
        </div>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="form-label">メモ（任意）</label>
        <input className="field-input" name="memo" defaultValue={visit.memo ?? ""} />
      </div>
      {error && (
        <div className="auth-error" style={{ gridColumn: "1 / -1" }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "保存中…" : "保存する"}
        </button>
        <button type="button" className="btn-ghost" disabled={pending} onClick={onDone}>
          キャンセル
        </button>
      </div>
    </form>
  );
}
