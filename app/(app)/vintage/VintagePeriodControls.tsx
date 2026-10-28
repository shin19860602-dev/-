"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function VintagePeriodControls({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState(month);
  const [pending, startTransition] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    if (downloading || pending || !selected) return;
    setDownloading(true); setMessage("");
    try {
      const response = await fetch(`/api/reports/vintage-sales?${new URLSearchParams({ month: selected })}`, { cache: "no-store" });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error ?? "Excelを作成できませんでした。");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `${selected}_KUJEKUJE_日別売上.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("Excelをダウンロードしました。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Excelを作成できませんでした。"); }
    finally { setDownloading(false); }
  }
  return <section className="card card-pad" style={{ marginBottom: 16 }} aria-label="古着の月別表示とExcel出力">
    <div className="card-title">月を選んで過去の売上を見る</div>
    <p className="card-sub">売上履歴・ダッシュボードを月別に確認できます。Excelは日別の現金売上・クレジット売上と月合計を出力します。</p>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
      <label style={{ display: "grid", gap: 6, minWidth: 0 }}><span className="field-label">表示する月</span><input type="month" required min="2000-01" max="9999-12" value={selected} aria-label="古着の表示月" style={{ fontSize: 16, maxWidth: "100%" }} onChange={event => {
        const value = event.target.value; setSelected(value); setMessage("");
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return;
        const params = new URLSearchParams(searchParams.toString()); params.set("month", value);
        startTransition(() => router.push(`${pathname}?${params}`));
      }} /></label>
      <button type="button" className="btn-primary" disabled={downloading || pending || !selected} onClick={download}>{downloading ? "Excelを作成中…" : "Excelをダウンロード"}</button>
    </div>
    <p className="card-sub" role="status" aria-live="polite">{pending ? "選択した月を表示しています…" : message}</p>
  </section>;
}
