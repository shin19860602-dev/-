"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergeCustomers } from "./actions";

export type MergeCandidate = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
  birthday: Date | null;
  visits: number;
};

export default function MergeCustomerForm({ target, candidates, storeSlug }: {
  target: MergeCandidate;
  candidates: MergeCandidate[];
  storeSlug: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const source = candidates.find((c) => c.id === sourceId);
  const matches = candidates.filter((c) => [c.name, c.kana, c.phone].some((v) => v?.includes(query.trim())));
  const birthday = (value: Date | null) => value ? new Date(value).toISOString().slice(0, 10) : "未登録";

  return (
    <div style={{ margin: "18px 0", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <button className="btn-ghost" type="button" aria-expanded={expanded} disabled={pending} onClick={() => setExpanded(!expanded)}>
        重複したカルテを統合
      </button>
      {expanded && <div style={{ marginTop: 12 }}>
        <div className="card-sub">今開いている「{target.name} 様」のカルテを残します。同じ人物であることを確認して、統合するもう1件を選んでください。</div>
        <label className="form-label">統合元を検索（名前・ふりがな・電話番号）
          <input className="field-input" disabled={pending} defaultValue="" onInput={(e) => setQuery(e.currentTarget.value)} />
        </label>
        <label className="form-label">統合するカルテ
          <select className="field-select" value={sourceId} disabled={pending} onChange={(e) => { setSourceId(e.target.value); setError(null); }}>
            <option value="">選択してください</option>
            {source && !matches.some((c) => c.id === source.id) && <option value={source.id}>{source.name} 様（{source.visits}回来店）</option>}
            {matches.map((c) => <option key={c.id} value={c.id}>{c.name} 様／{c.kana || "ふりがな未登録"}／{c.phone || "電話未登録"}（{c.visits}回来店）</option>)}
          </select>
        </label>
        {candidates.length === 0 && <div className="card-sub">同じ店舗に統合できる別のカルテがありません。</div>}
        {source && <>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>確認項目</th><th>残すカルテ</th><th>統合元（非表示）</th></tr></thead>
              <tbody>
                <tr><td>名前</td><td>{target.name}</td><td>{source.name}</td></tr>
                <tr><td>ふりがな</td><td>{target.kana || "未登録"}</td><td>{source.kana || "未登録"}</td></tr>
                <tr><td>電話番号</td><td>{target.phone || "未登録"}</td><td>{source.phone || "未登録"}</td></tr>
                <tr><td>生年月日</td><td>{birthday(target.birthday)}</td><td>{birthday(source.birthday)}</td></tr>
                <tr><td>来店回数</td><td>{target.visits}回</td><td>{source.visits}回</td></tr>
              </tbody>
            </table>
          </div>
          <div className="card-sub">統合後の来店回数：{target.visits + source.visits}回。すべての施術履歴・売上を移します。売上金額は変更しません。</div>
          <div className="card-sub">両方に値がある基本情報は残すカルテを優先し、空欄を補完します。会員登録日は早い日、会員種別はプレミアムを優先し、注意事項は両方を残します。統合元の基本情報は非表示で保管します。統合を取り消す機能はありません。</div>
          <button className="btn-primary" type="button" disabled={pending} onClick={() => {
            if (!confirm(`「${source.name} 様」の全施術履歴・売上を「${target.name} 様」に移し、統合元を非表示にします。同じ人物であることを確認しましたか？\nこの統合を画面から取り消すことはできません。`)) return;
            setError(null);
            startTransition(async () => {
              const result = await mergeCustomers(target.id, source.id);
              if (!result.ok) { setError(result.error); return; }
              const params = new URLSearchParams({ store: storeSlug, customer: result.customerId });
              setExpanded(false);
              setSourceId("");
              router.push(`/karte?${params.toString()}`);
              router.refresh();
            });
          }}>{pending ? "統合中…" : "確認して統合する"}</button>
        </>}
        {error && <div className="auth-error" role="alert">{error}</div>}
      </div>}
    </div>
  );
}
