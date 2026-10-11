"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVisit } from "./actions";
import { yen, visitTotal } from "@/lib/analytics";
import VisitEditForm from "./VisitEditForm";

const BADGE_CLASS: Record<string, string> = { a: "badge-store-a", b: "badge-store-b", c: "badge-store-c" };
const PAYMENT_LABEL: Record<string, string> = { cash: "現金", credit: "クレジット" };
const dateLabel = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;

type Visit = {
  id: string;
  date: Date;
  menuName: string;
  amount: number;
  category: string | null;
  productName: string | null;
  productAmount: number | null;
  pointAmount: number | null;
  paymentMethod: string | null;
  memo: string | null;
  store: { slug: string; name: string; colorKey: string; kind: string };
  staff: { name: string };
  customer: { id: string; name: string };
};

export default function VisitsTable({ visits, canEdit }: { visits: Visit[]; canEdit: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="table-wrap table-scroll">
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
                <td data-label="お客様">
                  <Link href={{ pathname: "/karte", query: { store: v.store.slug, customer: v.customer.id } }} style={{ color: "var(--text)", textDecoration: "underline", textUnderlineOffset: 3 }} title="カルテを開く">
                    {v.customer.name} 様
                  </Link>
                </td>
                <td data-label="施術内容">
                  {v.menuName || "店販のみ"}
                  {v.category && <span className="card-sub" style={{ margin: 0 }}>分類：{v.category}</span>}
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
  return <tr><td colSpan={colSpan}><VisitEditForm visit={visit} storeKind={visit.store.kind} onDone={onDone} /></td></tr>;
}
