import { pctDelta, yen, type PeriodSummary } from "@/lib/analytics";

const GENDER_LABEL: Record<string, string> = { male: "男性", female: "女性", other: "その他", unknown: "不明" };

function DeltaTag({ current, previous }: { current: number; previous: number }) {
  const d = pctDelta(current, previous);
  if (previous === 0 && current === 0) return null;
  return (
    <span className={`kpi-delta ${d.dir === "down" ? "down" : "up"}`} style={{ marginLeft: 6 }}>
      {d.dir === "down" ? "▼" : "▲"} {d.pct.toFixed(1)}%
    </span>
  );
}

function genderRatioLabel(summary: PeriodSummary) {
  if (summary.customerCount === 0) return null;
  return [...summary.genderCounts.entries()]
    .map(([g, c]) => `${GENDER_LABEL[g] ?? "不明"} ${Math.round((c / summary.customerCount) * 100)}%`)
    .join("・");
}

export default function SummaryStats({ summary, compare }: { summary: PeriodSummary; compare: PeriodSummary }) {
  const ratio = genderRatioLabel(summary);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
      <div className="field">
        <div className="field-label">客数</div>
        <div className="field-value">
          {summary.customerCount}名
          {ratio && (
            <span style={{ fontWeight: 400, color: "var(--text-dim)", fontSize: 12 }}> （{ratio}）</span>
          )}
          <DeltaTag current={summary.customerCount} previous={compare.customerCount} />
        </div>
      </div>
      <div className="field">
        <div className="field-label">客単価平均</div>
        <div className="field-value">
          {yen(summary.avgPerCustomer)}
          <DeltaTag current={summary.avgPerCustomer} previous={compare.avgPerCustomer} />
        </div>
      </div>

      <div className="field">
        <div className="field-label">技術売上合計</div>
        <div className="field-value">
          {yen(summary.serviceTotal)}
          <DeltaTag current={summary.serviceTotal} previous={compare.serviceTotal} />
        </div>
      </div>
      <div className="field">
        <div className="field-label">技術売上平均（1件）</div>
        <div className="field-value">
          {yen(summary.serviceAvg)}
          <DeltaTag current={summary.serviceAvg} previous={compare.serviceAvg} />
        </div>
      </div>

      <div className="field">
        <div className="field-label">商品売上合計</div>
        <div className="field-value">
          {yen(summary.productTotal)}
          <DeltaTag current={summary.productTotal} previous={compare.productTotal} />
        </div>
      </div>
      <div className="field">
        <div className="field-label">商品売上平均（1件）</div>
        <div className="field-value">
          {yen(summary.productAvg)}
          <DeltaTag current={summary.productAvg} previous={compare.productAvg} />
        </div>
      </div>
    </div>
  );
}
