"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCashCollection, deleteCashCollection } from "./actions";
import { yen } from "@/lib/analytics";
import { sanitizeAmountInput } from "@/lib/format";

const dateLabel = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const toDateInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Store = { id: string; name: string };
type Collection = {
  id: string;
  date: Date;
  amount: number;
  memo: string | null;
  store: { id: string; name: string };
};

export default function CollectionsTable({ collections, stores }: { collections: Collection[]; stores: Store[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="table-wrap table-scroll">
      <table>
        <thead>
          <tr>
            <th>日付</th>
            <th>店舗</th>
            <th>メモ</th>
            <th style={{ textAlign: "right" }}>金額</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {collections.map((c) =>
            editingId === c.id ? (
              <EditRow key={c.id} collection={c} stores={stores} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={c.id}>
                <td data-label="日付">{dateLabel(c.date)}</td>
                <td data-label="店舗">{c.store.name}</td>
                <td data-label="メモ">{c.memo || "-"}</td>
                <td data-label="金額" style={{ textAlign: "right" }}>
                  {yen(c.amount)}
                </td>
                <td data-label="操作">
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => setEditingId(c.id)}>
                      編集
                    </button>
                    <DeleteButton collectionId={c.id} onDone={() => router.refresh()} />
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
      {collections.length === 0 && (
        <div className="card-sub" style={{ padding: 20 }}>
          回収の記録はまだありません。
        </div>
      )}
    </div>
  );
}

function DeleteButton({ collectionId, onDone }: { collectionId: string; onDone: () => void }) {
  const [deleting, startDelete] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost"
      style={{ padding: "4px 10px", fontSize: 11.5, color: "var(--bad)", borderColor: "var(--bad)" }}
      disabled={deleting}
      onClick={() => {
        if (!confirm("この回収記録を削除しますか？この操作は元に戻せません。")) return;
        startDelete(async () => {
          const result = await deleteCashCollection(collectionId);
          if (result.ok) onDone();
          else alert(result.error);
        });
      }}
    >
      {deleting ? "削除中…" : "削除"}
    </button>
  );
}

function EditRow({ collection, stores, onDone }: { collection: Collection; stores: Store[]; onDone: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState(collection.store.id);
  const [pending, startTransition] = useTransition();

  return (
    <tr>
      <td colSpan={5}>
        <form
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, padding: "10px 0" }}
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await updateCashCollection(formData);
              if (result.ok) {
                onDone();
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <input type="hidden" name="collectionId" value={collection.id} />
          <div>
            <label className="form-label">日付</label>
            <input className="field-input" name="date" type="date" defaultValue={toDateInput(collection.date)} required />
          </div>
          <div>
            <label className="form-label">店舗</label>
            <select className="field-select" name="storeId" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">金額（円）</label>
            <input
              className="field-input"
              name="amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={collection.amount || ""}
              onChange={sanitizeAmountInput}
            />
          </div>
          <div>
            <label className="form-label">メモ（任意）</label>
            <input className="field-input" name="memo" defaultValue={collection.memo ?? ""} />
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
