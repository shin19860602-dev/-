"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCashAdjustment } from "./adjustmentActions";
import { yen } from "@/lib/analytics";

const dateLabel = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

type Adjustment = { id: string; date: Date; enteredBalance: number; delta: number; memo: string | null };

export default function AdjustmentsTable({ adjustments }: { adjustments: Adjustment[] }) {
  const router = useRouter();

  return (
    <div className="table-wrap table-scroll">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>メモ</th>
            <th style={{ textAlign: "right" }}>入力した残高</th>
            <th style={{ textAlign: "right" }}>調整額</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {adjustments.map((a) => (
            <tr key={a.id}>
              <td data-label="日付">{dateLabel(a.date)}</td>
              <td data-label="メモ">{a.memo || "-"}</td>
              <td data-label="入力した残高" style={{ textAlign: "right" }}>
                {yen(a.enteredBalance)}
              </td>
              <td data-label="調整額" style={{ textAlign: "right", color: a.delta < 0 ? "var(--bad)" : undefined }}>
                {a.delta > 0 ? "＋" : ""}
                {yen(a.delta)}
              </td>
              <td data-label="操作">
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <DeleteButton adjustmentId={a.id} onDone={() => router.refresh()} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {adjustments.length === 0 && (
        <div className="card-sub" style={{ padding: 20 }}>
          残高調整の記録はまだありません。
        </div>
      )}
    </div>
  );
}

function DeleteButton({ adjustmentId, onDone }: { adjustmentId: string; onDone: () => void }) {
  const [deleting, startDelete] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost"
      style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--bad)", borderColor: "var(--bad)" }}
      disabled={deleting}
      onClick={() => {
        if (!confirm("この調整記録を削除しますか？残高の計算に影響します。")) return;
        startDelete(async () => {
          const result = await deleteCashAdjustment(adjustmentId);
          if (result.ok) onDone();
          else alert(result.error);
        });
      }}
    >
      {deleting ? "削除中…" : "削除"}
    </button>
  );
}
