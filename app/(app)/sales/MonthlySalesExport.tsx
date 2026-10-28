"use client";

import { useState } from "react";

export default function MonthlySalesExport({ initialMonth, storeSlug, scopeLabel }: { initialMonth: string; storeSlug?: string; scopeLabel: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const query = new URLSearchParams({ month });
      if (storeSlug) query.set("store", storeSlug);
      const response = await fetch(`/api/reports/monthly-sales?${query}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Excelを作成できませんでした。");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${month}_${scopeLabel.replace(/[\\/:*?"<>|]/g, "_")}_日別売上・経費.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMessage("Excelをダウンロードしました。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Excelを作成できませんでした。"); }
    finally { setBusy(false); }
  }
  return <section className="card card-pad" style={{ marginBottom: 16 }} aria-label="月別Excel出力">
    <div className="card-title">日別売上・経費をExcelに出力</div>
    <p className="card-sub">{scopeLabel} ／ 1日〜月末の日別表と月合計。現金・クレジットは技術分で、商品・ポイント・経費は別列です。</p>
    <form onSubmit={download} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
      <label style={{ display: "grid", gap: 6, minWidth: 0 }}><span className="field-label">出力する月</span><input type="month" required min="2000-01" max="9999-12" aria-label="Excelの出力月" value={month} onChange={event => { setMonth(event.target.value); setMessage(""); }} style={{ fontSize: 16, maxWidth: "100%" }} /></label>
      <button type="submit" className="btn-primary" disabled={busy || !month}>{busy ? "Excelを作成中…" : "Excelをダウンロード"}</button>
    </form>
    <p role="status" aria-live="polite" className="card-sub">{message}</p>
  </section>;
}
