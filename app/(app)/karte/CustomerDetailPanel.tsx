"use client";

import { useState } from "react";
import { yen, visitTotal } from "@/lib/analytics";
import { givenNameInitial as initial } from "@/lib/format";
import EditCustomerForm from "./EditCustomerForm";

const GENDER_LABEL: Record<string, string> = { male: "男性", female: "女性", other: "その他" };

const dateLabel = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
const age = (birthday: Date | null) => {
  if (!birthday) return null;
  const now = new Date();
  let a = now.getFullYear() - birthday.getFullYear();
  const beforeBirthday = now.getMonth() < birthday.getMonth() || (now.getMonth() === birthday.getMonth() && now.getDate() < birthday.getDate());
  if (beforeBirthday) a -= 1;
  return a;
};

type Staff = { id: string; name: string; title: string | null };
type Visit = {
  id: string;
  date: Date;
  menuName: string;
  amount: number;
  productName: string | null;
  productAmount: number | null;
  pointAmount: number | null;
  memo: string | null;
  chemicalDetail: string | null;
  staff: { name: string };
};
type Customer = {
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
  memberSince: Date | null;
  allergyNote: string | null;
  primaryStaffId: string | null;
  primaryStaff: { name: string } | null;
  store: { name: string; colorKey: string };
  visits: Visit[];
};

export default function CustomerDetailPanel({ customer, staffOptions }: { customer: Customer; staffOptions: Staff[] }) {
  const [editing, setEditing] = useState(false);
  const totalSpend = customer.visits.reduce((a, v) => a + visitTotal(v), 0);

  if (editing) {
    return <EditCustomerForm customer={customer} staffOptions={staffOptions} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="card card-pad">
      <div className="customer-head">
        <div className="photo-ph">{initial(customer.name)}</div>
        <div style={{ flex: 1 }}>
          <h2 className="serif" style={{ margin: "0 0 4px", fontSize: 20 }}>
            {customer.name} 様
          </h2>
          <span className={`badge badge-store-${customer.store.colorKey}`}>{customer.store.name}</span>
          <span className="badge badge-good" style={{ marginLeft: 6 }}>
            {customer.tier}
          </span>
        </div>
        <button type="button" className="btn-ghost" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setEditing(true)}>
          編集する
        </button>
      </div>

      <div className="field-grid">
        <div className="field">
          <div className="field-label">性別</div>
          <div className="field-value">{GENDER_LABEL[customer.gender ?? ""] ?? "未登録"}</div>
        </div>
        <div className="field">
          <div className="field-label">生年月日</div>
          <div className="field-value">
            {customer.birthday ? `${dateLabel(customer.birthday)}（${age(customer.birthday)}歳）` : "未登録"}
          </div>
        </div>
        <div className="field">
          <div className="field-label">電話番号</div>
          <div className="field-value">{customer.phone || "未登録"}</div>
        </div>
        <div className="field">
          <div className="field-label">郵便番号</div>
          <div className="field-value">{customer.postalCode || "未登録"}</div>
        </div>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <div className="field-label">住所</div>
          <div className="field-value">{customer.address || "未登録"}</div>
        </div>
        <div className="field">
          <div className="field-label">会員登録日</div>
          <div className="field-value">{customer.memberSince ? dateLabel(customer.memberSince) : "未登録"}</div>
        </div>
        <div className="field">
          <div className="field-label">来店回数</div>
          <div className="field-value">{customer.visits.length}回</div>
        </div>
        <div className="field">
          <div className="field-label">累計ご利用額</div>
          <div className="field-value">{yen(totalSpend)}</div>
        </div>
        <div className="field">
          <div className="field-label">担当スタイリスト</div>
          <div className="field-value">{customer.primaryStaff?.name ?? "未設定"}</div>
        </div>
      </div>

      {customer.allergyNote && (
        <div className="alert-box">
          <span style={{ fontSize: 15, lineHeight: 1 }}>⚠️</span>
          <div>
            <strong>アレルギー・注意事項：</strong>
            {customer.allergyNote}
          </div>
        </div>
      )}

      <div className="card-title" style={{ marginBottom: 10 }}>
        施術履歴
      </div>
      <div className="timeline">
        {customer.visits.map((v) => (
          <div className="tl-item" key={v.id}>
            <div className="tl-date">{dateLabel(v.date)}</div>
            <div className="tl-body">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div className="tl-title">
                  {v.menuName}
                  {v.productName ? `＋店販：${v.productName}` : ""}
                  {v.pointAmount ? `＋ポイント${yen(v.pointAmount)}` : ""}
                </div>
                <div className="tl-amount">{yen(visitTotal(v))}</div>
              </div>
              <div className="tl-detail">
                担当：{v.staff.name}
                {v.memo ? `／メモ：${v.memo}` : ""}
                {v.chemicalDetail ? `／${v.chemicalDetail}` : ""}
              </div>
            </div>
          </div>
        ))}
        {customer.visits.length === 0 && <div className="card-sub">まだ施術履歴がありません。</div>}
      </div>
    </div>
  );
}
