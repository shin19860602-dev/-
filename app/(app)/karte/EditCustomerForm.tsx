"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomer, deleteCustomer } from "./actions";

type Staff = { id: string; name: string; title: string | null };
type CustomerDetail = {
  id: string;
  storeId: string;
  name: string;
  kana: string | null;
  gender: string | null;
  birthday: Date | null;
  phone: string | null;
  postalCode: string | null;
  address: string | null;
  tier: string;
  primaryStaffId: string | null;
  allergyNote: string | null;
};

const toDateInput = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default function EditCustomerForm({
  customer,
  staffOptions,
  onDone,
}: {
  customer: CustomerDetail;
  staffOptions: Staff[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-title">お客様情報を編集</div>
      {error && <div className="auth-error">{error}</div>}
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await updateCustomer(formData);
            if (result.ok) {
              onDone();
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <input type="hidden" name="customerId" value={customer.id} />
        <input type="hidden" name="storeId" value={customer.storeId} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 }}>
          <div>
            <label className="form-label">お名前</label>
            <input className="field-input" name="name" defaultValue={customer.name} required />
          </div>
          <div>
            <label className="form-label">ふりがな</label>
            <input className="field-input" name="kana" defaultValue={customer.kana ?? ""} />
          </div>
          <div>
            <label className="form-label">性別</label>
            <select className="field-select" name="gender" defaultValue={customer.gender ?? "female"}>
              <option value="female">女性</option>
              <option value="male">男性</option>
              <option value="other">その他</option>
            </select>
          </div>
          <div>
            <label className="form-label">生年月日</label>
            <input className="field-input" type="date" name="birthday" defaultValue={toDateInput(customer.birthday)} />
          </div>
          <div>
            <label className="form-label">電話番号</label>
            <input className="field-input" name="phone" defaultValue={customer.phone ?? ""} placeholder="090-0000-0000" />
          </div>
          <div>
            <label className="form-label">郵便番号</label>
            <input className="field-input" name="postalCode" defaultValue={customer.postalCode ?? ""} placeholder="150-0001" />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label className="form-label">住所</label>
            <input className="field-input" name="address" defaultValue={customer.address ?? ""} placeholder="東京都渋谷区神宮前1-2-3" />
          </div>
          <div>
            <label className="form-label">会員種別</label>
            <select className="field-select" name="tier" defaultValue={customer.tier}>
              <option value="一般会員">一般会員</option>
              <option value="プレミアム会員">プレミアム会員</option>
            </select>
          </div>
          <div>
            <label className="form-label">担当スタイリスト（任意）</label>
            <select className="field-select" name="primaryStaffId" defaultValue={customer.primaryStaffId ?? ""}>
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
            <textarea className="field-textarea" name="allergyNote" rows={2} defaultValue={customer.allergyNote ?? ""} placeholder="例：ジアミン系カラー剤にかぶれの既往あり" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" type="submit" disabled={pending || deleting}>
              {pending ? "保存中…" : "保存する"}
            </button>
            <button className="btn-ghost" type="button" onClick={onDone} disabled={pending || deleting}>
              キャンセル
            </button>
          </div>
          <button
            type="button"
            className="btn-ghost"
            style={{ color: "var(--bad)", borderColor: "var(--bad)" }}
            disabled={pending || deleting}
            onClick={() => {
              if (!confirm(`${customer.name} 様を削除しますか？施術履歴がある場合は一覧から非表示になります（記録は残ります）。`)) return;
              startDelete(async () => {
                const result = await deleteCustomer(customer.id);
                if (result.ok) {
                  onDone();
                  router.push("/karte");
                  router.refresh();
                } else {
                  setError(result.error);
                }
              });
            }}
          >
            {deleting ? "削除中…" : "削除する"}
          </button>
        </div>
      </form>
    </div>
  );
}
