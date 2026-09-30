"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBankDeposit, deleteBankDeposit } from "./bankActions";
import { yen } from "@/lib/analytics";
import { sanitizeAmountInput } from "@/lib/format";

const dateLabel = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Deposit = { id: string; date: Date; amount: number; memo: string | null };

export default function BankDepositsTable({ deposits }: { deposits: Deposit[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="table-wrap table-scroll">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>メモ</th>
            <th style={{ textAlign: "right" }}>金額</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {deposits.map((d) =>
            editingId === d.id ? (
              <EditRow key={d.id} deposit={d} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={d.id}>
                <td data-label="日付">{dateLabel(d.date)}</td>
                <td data-label="メモ">{d.memo || "-"}</td>
                <td data-label="金額" style={{ textAlign: "right" }}>
                  {yen(d.amount)}
                </td>
                <td data-label="操作">
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => setEditingId(d.id)}>
                      編集
                    </button>
                    <DeleteButton depositId={d.id} onDone={() => router.refresh()} />
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      {deposits.length === 0 && (
        <div className="card-sub" style={{ padding: 20 }}>
          入金の記録はまだありません。
        </div>
      )}
    </div>
  );
}

function DeleteButton({ depositId, onDone }: { depositId: string; onDone: () => void }) {
  const [deleting, startDelete] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost"
      style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--bad)", borderColor: "var(--bad)" }}
      disabled={deleting}
      onClick={() => {
        if (!confirm("この入金記録を削除しますか？この操作は元に戻せません。")) return;
        startDelete(async () => {
          const result = await deleteBankDeposit(depositId);
          if (result.ok) onDone();
          else alert(result.error);
        });
      }}
    >
      {deleting ? "削除中…" : "削除"}
    </button>
  );
}

function EditRow({ deposit, onDone }: { deposit: Deposit; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <tr>
      <td colSpan={4}>
        <form
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, padding: "10px 0" }}
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await updateBankDeposit(formData);
              if (result.ok) {
                onDone();
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <input type="hidden" name="depositId" value={deposit.id} />
          <div>
            <label className="form-label">日付</label>
            <input className="field-input" name="date" type="date" defaultValue={toDateInput(deposit.date)} required />
          </div>
          <div>
            <label className="form-label">金額（円）</label>
            <input
              className="field-input"
              name="amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={deposit.amount || ""}
              onChange={sanitizeAmountInput}
            />
          </div>
          <div>
            <label className="form-label">メモ（任意）</label>
            <input className="field-input" name="memo" defaultValue={deposit.memo ?? ""} />
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
