"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function KarteSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    params.delete("customer");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="search-box">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text-faint)" }}>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        placeholder="お客様名で検索"
        defaultValue={searchParams.get("q") ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
