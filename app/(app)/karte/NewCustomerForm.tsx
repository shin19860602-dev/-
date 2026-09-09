"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCustomer } from "./actions";

type Store = { id: string; name: string };
type Staff = { id: string; name: string; storeId: string | null; title: string | null };

export default function NewCustomerForm({
  isOwner,
  fixedStoreId,
  stores,
  staff,
}: {
  isOwner: boolean;
  fixedStoreId?: string;
  stores: Store[];
  staff: Staff[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [storeId, setStoreId] = useState(fixedStoreId ?? stores[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const staffOptions = useMemo(() => staff.filter((s) => s.storeId === storeId), [staff, storeId]);

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)} type="button" style={{ width: "100%", marginBottom: 12 }}>
        ＋ 新規のお客様
      </button>
    );
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-title">新規のお客様を登録</div>
      {error && <div className="auth-error">{error}</div>}
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await createCustomer(formData);
            if (result.ok) {
              setOpen(false);
              router.push(`?customer=${result.customerId}`);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
          {isOwner && !fixedStoreId ? (
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
          ) : (
            <input type="hidden" name="storeId" value={storeId} />
          )}
          <div>
            <label className="form-label">お名前</label>
            <input className="field-input" name="name" required />
          </div>
          <div>
            <label className="form-label">ふりがな</label>
            <input className="field-input" name="kana" />
          </div>
          <div>
            <label className="form-label">性別</label>
            <select className="field-select" name="gender" defaultValue="female">
              <option value="female">女性</option>
              <option value="male">男性</option>
              <option value="other">その他</option>
            </select>
          </div>
          <div>
            <label className="form-label">生年月日</label>
            <input className="field-input" type="date" name="birthday" />
          </div>
          <div>
            <label className="form-label">電話番号</label>
            <input className="field-input" name="phone" placeholder="090-0000-0000" />
          </div>
          <div>
            <label className="form-label">郵便番号</label>
            <input className="field-input" name="postalCode" placeholder="150-0001" />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">住所</label>
            <input className="field-input" name="address" placeholder="東京都渋谷区神宮前1-2-3" />
          </div>
          <div>
            <label className="form-label">会員種別</label>
            <select className="field-select" name="tier" defaultValue="一般会員">
              <option value="一般会員">一般会員</option>
              <option value="プレミアム会員">プレミアム会員</option>
            </select>
          </div>
          <div>
            <label className="form-label">担当スタイリスト（任意）</label>
            <select className="field-select" name="primaryStaffId" defaultValue="">
              <option value="">未設定</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}（{s.title}）
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">アレルギー・注意事項（任意）</label>
            <textarea className="field-textarea" name="allergyNote" rows={2} placeholder="例：ジアミン系カラー剤にかぶれの既往あり" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? "登録中…" : "登録する"}
          </button>
          <button className="btn-ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
