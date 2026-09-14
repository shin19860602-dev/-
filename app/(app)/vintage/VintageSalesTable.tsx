"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVintageSale, deleteVintageSale } from "./actions";
import { yen } from "@/lib/analytics";
import { sanitizeAmountInput } from "@/lib/format";

const PAYMENT_LABEL: Record<string, string> = { cash: "現金", credit: "クレジット" };
const dateLabel = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Sale = {
  id: string;
  date: Date;
  category: string | null;
  brand: string | null;
  amount: number;
  paymentMethod: string | null;
  memo: string | null;
  staff: { name: string };
};

export default function VintageSalesTable({
  sales,
  canEdit,
  categories,
  brands,
}: {
  sales: Sale[];
  canEdit: boolean;
  categories: string[];
  brands: string[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="table-wrap table-scroll">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>担当スタッフ</th>
            <th>分類</th>
            <th>ブランド</th>
            <th>メモ</th>
            <th>お支払い</th>
            <th style={{ textAlign: "right" }}>金額</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {sales.map((s) =>
            editingId === s.id ? (
              <EditRow
                key={s.id}
                sale={s}
                colSpan={canEdit ? 8 : 7}
                categories={categories}
                brands={brands}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <tr key={s.id}>
                <td data-label="日付">{dateLabel(s.date)}</td>
                <td data-label="担当">{s.staff.name}</td>
                <td data-label="分類">{s.category ?? "-"}</td>
                <td data-label="ブランド">{s.brand ?? "-"}</td>
                <td data-label="メモ">{s.memo ?? "-"}</td>
                <td data-label="お支払い">{s.paymentMethod ? PAYMENT_LABEL[s.paymentMethod] ?? s.paymentMethod : "-"}</td>
                <td data-label="金額" style={{ textAlign: "right" }}>
                  {yen(s.amount)}
                </td>
                {canEdit && (
                  <td data-label="操作">
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button type="button" className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => setEditingId(s.id)}>
                        編集
                      </button>
                      <DeleteButton saleId={s.id} onDone={() => router.refresh()} />
                    </div>
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
      {sales.length === 0 && (
        <div className="card-sub" style={{ padding: 20 }}>
          この条件に一致する売上はまだありません。
        </div>
      )}
    </div>
  );
}

function DeleteButton({ saleId, onDone }: { saleId: string; onDone: () => void }) {
  const [deleting, startDelete] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost"
      style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--bad)", borderColor: "var(--bad)" }}
      disabled={deleting}
      onClick={() => {
        if (!confirm("この売上記録を削除しますか？この操作は元に戻せません。")) return;
        startDelete(async () => {
          const result = await deleteVintageSale(saleId);
          if (result.ok) onDone();
          else alert(result.error);
        });
      }}
    >
      {deleting ? "削除中…" : "削除"}
    </button>
  );
}

function EditRow({
  sale,
  colSpan,
  categories,
  brands,
  onDone,
}: {
  sale: Sale;
  colSpan: number;
  categories: string[];
  brands: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">((sale.paymentMethod as "cash" | "credit") ?? "cash");
  const [category, setCategory] = useState<string | null>(sale.category);
  const [brand, setBrand] = useState<string | null>(sale.brand);
  const [pending, startTransition] = useTransition();

  return (
    <tr>
      <td colSpan={colSpan}>
        <form
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, padding: "10px 0" }}
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await updateVintageSale(formData);
              if (result.ok) {
                onDone();
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <input type="hidden" name="saleId" value={sale.id} />
          <div>
            <label className="form-label">日付</label>
            <input className="field-input" name="date" type="date" defaultValue={toDateInput(sale.date)} required />
          </div>
          <div>
            <label className="form-label">金額（円）</label>
            <input
              className="field-input"
              name="amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={sale.amount}
              required
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
          <div style={{ gridColumn: "1 / -1" }}>
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

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">メモ（任意）</label>
            <input className="field-input" name="memo" defaultValue={sale.memo ?? ""} />
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
      </td>
    </tr>
  );
}
