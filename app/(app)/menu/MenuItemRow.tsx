"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMenuItemActive, updateMenuItem, deleteMenuItem, moveMenuItem } from "./actions";
import { yen } from "@/lib/analytics";
import { sanitizeAmountInput } from "@/lib/format";

export default function MenuItemRow({
  id,
  name,
  price,
  active,
  canEdit,
  isFirst,
  isLast,
}: {
  id: string;
  name: string;
  price: number;
  active: boolean;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [moving, startMove] = useTransition();

  if (editing) {
    return (
      <form
        className="list-row"
        style={{ flexWrap: "wrap", gap: 8 }}
        action={(formData) => {
          setError(null);
          startSave(async () => {
            const result = await updateMenuItem(formData);
            if (result.ok) {
              setEditing(false);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input className="field-input" name="name" defaultValue={name} required style={{ flex: "1 1 200px" }} />
        <input
          className="field-input"
          name="price"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={price}
          required
          style={{ width: 110 }}
          onChange={sanitizeAmountInput}
        />
        <button className="btn-primary" type="submit" disabled={saving} style={{ padding: "5px 12px", fontSize: 11.5 }}>
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ padding: "5px 12px", fontSize: 11.5 }}
          disabled={saving}
          onClick={() => {
            setError(null);
            setEditing(false);
          }}
        >
          キャンセル
        </button>
        {error && <div className="auth-error" style={{ flexBasis: "100%" }}>{error}</div>}
      </form>
    );
  }

  return (
    <div className="list-row">
      <div className="grow">
        <div className="title" style={{ opacity: active ? 1 : 0.5 }}>
          {name}
        </div>
        <div className="meta">{yen(price)}</div>
      </div>
      {canEdit && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "5px 8px", fontSize: 11.5 }}
            disabled={moving || isFirst}
            title="上に移動"
            onClick={() => {
              startMove(async () => {
                await moveMenuItem(id, "up");
                router.refresh();
              });
            }}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "5px 8px", fontSize: 11.5 }}
            disabled={moving || isLast}
            title="下に移動"
            onClick={() => {
              startMove(async () => {
                await moveMenuItem(id, "down");
                router.refresh();
              });
            }}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "5px 12px", fontSize: 11.5 }}
            disabled={pending || deleting}
            onClick={() => setEditing(true)}
          >
            編集
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "5px 12px", fontSize: 11.5 }}
            disabled={pending || deleting}
            onClick={() => {
              startTransition(async () => {
                await setMenuItemActive(id, !active);
                router.refresh();
              });
            }}
          >
            {active ? "非表示にする" : "再表示する"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "5px 12px", fontSize: 11.5, color: "var(--bad)", borderColor: "var(--bad)" }}
            disabled={pending || deleting}
            onClick={() => {
              if (!confirm(`「${name}」を削除しますか？この操作は元に戻せません。`)) return;
              startDelete(async () => {
                const result = await deleteMenuItem(id);
                if (result.ok) {
                  router.refresh();
                } else {
                  alert(result.error);
                }
              });
            }}
          >
            {deleting ? "削除中…" : "削除"}
          </button>
        </div>
      )}
    </div>
  );
}
