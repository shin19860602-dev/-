"use client";

import { useMemo, useRef, useState } from "react";

type Customer = { id: string; name: string; kana: string | null };

export default function CustomerCombobox({
  customers,
  name,
  placeholder,
}: {
  customers: Customer[];
  name: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return customers.slice(0, 30);
    return customers.filter((c) => c.name.startsWith(q) || (c.kana ?? "").startsWith(q)).slice(0, 30);
  }, [customers, query]);

  const select = (c: Customer) => {
    setSelectedId(c.id);
    if (inputRef.current) inputRef.current.value = `${c.name} 様`;
    setQuery(`${c.name} 様`);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input type="hidden" name={name} value={selectedId} />
      <input
        className="field-input"
        placeholder={placeholder ?? "お名前で検索"}
        // 入力欄はブラウザに管理させ、IME変換中にReactから文字列を書き戻さない。
        ref={inputRef}
        defaultValue=""
        onInput={(e) => {
          setQuery(e.currentTarget.value);
          setSelectedId("");
          setOpen(true);
        }}
        onCompositionEnd={(e) => {
          setQuery(e.currentTarget.value);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
        autoComplete="off"
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "var(--shadow)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {matches.length === 0 ? (
            <div className="card-sub" style={{ padding: "10px 14px" }}>
              該当するお客様が見つかりません。
            </div>
          ) : (
            matches.map((c) => (
              <div
                key={c.id}
                className="cust-item"
                style={{ borderRadius: 0, padding: "9px 14px" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (blurTimeout.current) clearTimeout(blurTimeout.current);
                  select(c);
                }}
              >
                <div className="name" style={{ fontSize: 13.5 }}>
                  {c.name} 様
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
