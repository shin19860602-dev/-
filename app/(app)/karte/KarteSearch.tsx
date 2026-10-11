"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

// IME変換前（ひらがな入力中）の文字列だけを拾う。Safari等はcompositionupdateまで
// input/changeイベントを発火しないため、確定・変換を待たず1文字目から検索できるようにする。
const HIRAGANA_RE = /^[ぁ-ゖー]+$/;

export default function KarteSearch({ categories }: { categories: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nameInput = useRef<HTMLInputElement>(null);

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    params.delete("customer");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <>
    <div className="search-box">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text-faint)" }}>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={nameInput}
        aria-label="お客様名・ふりがな"
        placeholder="お客様名・ふりがなで検索（部分一致）"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onCompositionUpdate={(e) => {
          const data = e.data ?? "";
          if (HIRAGANA_RE.test(data)) onChange(data);
        }}
        onCompositionEnd={(e) => onChange(e.currentTarget.value)}
      />
    </div>
    <form
      key={["gender", "category", "from", "to"].map((key) => searchParams.get(key) ?? "").join("|")}
      style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, margin: "12px 0" }}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const params = new URLSearchParams(searchParams.toString());
        for (const key of ["gender", "category", "from", "to"]) {
          const value = String(data.get(key) ?? "");
          if (value) params.set(key, value);
          else params.delete(key);
        }
        const q = nameInput.current?.value.trim() ?? "";
        if (q) params.set("q", q);
        else params.delete("q");
        params.delete("customer");
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }}
    >
      <label className="form-label">性別
        <select className="field-input" name="gender" defaultValue={searchParams.get("gender") ?? ""}>
          <option value="">すべて</option>
          <option value="male">男性</option>
          <option value="female">女性</option>
          <option value="other">その他</option>
          <option value="unknown">未登録</option>
        </select>
      </label>
      <label className="form-label">施術カテゴリ
        <select className="field-input" name="category" defaultValue={searchParams.get("category") ?? ""}>
          <option value="">すべて</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="form-label">来店日（開始）
        <input className="field-input" type="date" name="from" defaultValue={searchParams.get("from") ?? ""} />
      </label>
      <label className="form-label">来店日（終了）
        <input className="field-input" type="date" name="to" defaultValue={searchParams.get("to") ?? ""} />
      </label>
      <div className="card-sub" style={{ gridColumn: "1 / -1", margin: 0 }}>期間内に選択カテゴリで来店したお客様を検索します。</div>
      <button className="btn-primary" type="submit">絞り込む</button>
      <button className="btn-ghost" type="button" onClick={() => {
        const params = new URLSearchParams();
        const store = searchParams.get("store");
        if (store) params.set("store", store);
        if (nameInput.current) nameInput.current.value = "";
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }}>条件をクリア</button>
    </form>
    </>
  );
}
