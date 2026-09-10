"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateVisit, deleteVisit } from "./actions";
import { yen, visitTotal } from "@/lib/analytics";
import { sanitizeDigits } from "@/lib/format";

const BADGE_CLASS: Record<string, string> = { a: "badge-store-a", b: "badge-store-b", c: "badge-store-c" };
const PAYMENT_LABEL: Record<string, string> = { cash: "現金", credit: "クレジット" };
const dateLabel = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Visit = {
  id: string;
  date: Date;
  menuName: string;
  amount: number;
  productName: string | null;
  productAmount: number | null;
  pointAmount: number | null;
  paymentMethod: string | null;
  memo: string | null;
  store: { name: string; colorKey: string };
  staff: { name: string };
  customer: { name: string };
};

export default function VisitsTable({ visits, canEdit }: { visits: Visit[]; canEdit: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>店舗</th>
            <th>担当スタッフ</th>
            <th>お客様</th>
            <th>施術内容</th>
            <th>お支払い</th>
            <th style={{ textAlign: "right" }}>金額</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {visits.map((v) =>
            editingId === v.id ? (
              <EditRow key={v.id} visit={v} colSpan={canEdit ? 8 : 7} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={v.id}>
                <td data-label="日付">{dateLabel(v.date)}</td>
                <td data-label="店舗">
                  <span className={`badge ${BADGE_CLASS[v.store.colorKey]}`}>{v.store.name}</span>
                </td>
                <td data-label="担当">{v.staff.name}</td>
                <td data-label="お客様">{v.customer.name} 様</td>
                <td data-label="施術内容">
                  {v.menuName}
                  {v.productName && <span className="card-sub" style={{ margin: 0 }}>＋店販：{v.productName}</span>}
                  {v.pointAmount ? <span className="card-sub" style={{ margin: 0 }}>＋ポイント{yen(v.pointAmount)}</span> : null}
                </td>
                <td data-label="お支払い">{v.paymentMethod ? PAYMENT_LABEL[v.paymentMethod] ?? v.paymentMethod : "-"}</td>
                <td data-label="金額" style={{ textAlign: "right" }}>
                  {yen(visitTotal(v))}
                </td>
                {canEdit && (
                  <td data-label="操作">
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button type="button" className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => setEditingId(v.id)}>
                        編集
                      </button>
                      <DeleteButton visitId={v.id} onDone={() => router.refresh()} />
                    </div>
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
      {visits.length === 0 && (
        <div className="card-sub" style={{ padding: 20 }}>
          この条件に一致する売上はまだありません。
        </div>
      )}
    </div>
  );
}

function DeleteButton({ visitId, onDone }: { visitId: string; onDone: () => void }) {
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
          const result = await deleteVisit(visitId);
          if (result.ok) onDone();
          else alert(result.error);
        });
      }}
    >
      {deleting ? "削除中…" : "削除"}
    </button>
  );
}

function EditRow({ visit, colSpan, onDone }: { visit: Visit; colSpan: number; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">((visit.paymentMethod as "cash" | "credit") ?? "cash");
  const [pending, startTransition] = useTransition();

  return (
    <tr>
      <td colSpan={colSpan}>
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
            <label className="form-label">施術内容</label>
            <input className="field-input" name="menuName" defaultValue={visit.menuName} required />
          </div>
          <div>
            <label className="form-label">技術売上（円）</label>
            <input
              className="field-input"
              name="amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={visit.amount}
              required
              onChange={(e) => {
                e.target.value = sanitizeDigits(e.target.value);
              }}
            />
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
              onChange={(e) => {
                e.target.value = sanitizeDigits(e.target.value);
              }}
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
              onChange={(e) => {
                e.target.value = sanitizeDigits(e.target.value);
              }}
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
      </td>
    </tr>
  );
}
