"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateExpense, deleteExpense, EXPENSE_CATEGORIES } from "./expenseActions";
import { yen } from "@/lib/analytics";
import { sanitizeAmountInput } from "@/lib/format";

const dateLabel = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Expense = {
  id: string;
  date: Date;
  category: string;
  amount: number;
  memo: string | null;
};

export default function ExpensesTable({ expenses, canEdit }: { expenses: Expense[]; canEdit: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="table-wrap table-scroll">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>分類</th>
            <th>メモ</th>
            <th style={{ textAlign: "right" }}>金額</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) =>
            editingId === e.id ? (
              <EditRow key={e.id} expense={e} colSpan={canEdit ? 5 : 4} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={e.id}>
                <td data-label="日付">{dateLabel(e.date)}</td>
                <td data-label="分類">{e.category}</td>
                <td data-label="メモ">{e.memo || "-"}</td>
                <td data-label="金額" style={{ textAlign: "right" }}>
                  {yen(e.amount)}
                </td>
                {canEdit && (
                  <td data-label="操作">
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button type="button" className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => setEditingId(e.id)}>
                        編集
                      </button>
                      <DeleteButton expenseId={e.id} onDone={() => router.refresh()} />
                    </div>
                  </td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
      {expenses.length === 0 && (
        <div className="card-sub" style={{ padding: 20 }}>
          この条件に一致する経費はまだありません。
        </div>
      )}
    </div>
  );
}

function DeleteButton({ expenseId, onDone }: { expenseId: string; onDone: () => void }) {
  const [deleting, startDelete] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost"
      style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--bad)", borderColor: "var(--bad)" }}
      disabled={deleting}
      onClick={() => {
        if (!confirm("この経費記録を削除しますか？この操作は元に戻せません。")) return;
        startDelete(async () => {
          const result = await deleteExpense(expenseId);
          if (result.ok) onDone();
          else alert(result.error);
        });
      }}
    >
      {deleting ? "削除中…" : "削除"}
    </button>
  );
}

function EditRow({ expense, colSpan, onDone }: { expense: Expense; colSpan: number; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof EXPENSE_CATEGORIES)[number]>(
    (EXPENSE_CATEGORIES as readonly string[]).includes(expense.category) ? (expense.category as (typeof EXPENSE_CATEGORIES)[number]) : EXPENSE_CATEGORIES[0]
  );
  const [pending, startTransition] = useTransition();

  return (
    <tr>
      <td colSpan={colSpan}>
        <form
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, padding: "10px 0" }}
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await updateExpense(formData);
              if (result.ok) {
                onDone();
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <input type="hidden" name="expenseId" value={expense.id} />
          <input type="hidden" name="category" value={category} />
          <div>
            <label className="form-label">日付</label>
            <input className="field-input" name="date" type="date" defaultValue={toDateInput(expense.date)} required />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">分類</label>
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
          <div>
            <label className="form-label">金額（円）</label>
            <input
              className="field-input"
              name="amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={expense.amount || ""}
              onChange={sanitizeAmountInput}
            />
          </div>
          <div>
            <label className="form-label">メモ（任意）</label>
            <input className="field-input" name="memo" defaultValue={expense.memo ?? ""} />
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
