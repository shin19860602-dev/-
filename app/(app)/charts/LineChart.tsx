import { niceMax } from "@/lib/analytics";

type Series = { key: string; label: string; color: string; values: number[] };

export default function LineChart({
  categories,
  series,
  unit,
  valueFormatter,
}: {
  categories: string[];
  series: Series[];
  unit?: string;
  valueFormatter?: (v: number) => string;
}) {
  const width = 560;
  const height = 210;
  const padLeft = 42;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 40;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const steps = 3;
  const fmt = valueFormatter ?? ((v: number) => String(Math.round(v)));

  const xFor = (i: number) => padLeft + (categories.length === 1 ? plotW / 2 : (i / (categories.length - 1)) * plotW);
  const yFor = (v: number) => padTop + plotH - (v / max) * plotH;

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + plotH} className="axis-line" />
        <line x1={padLeft} y1={padTop + plotH} x2={width - padRight} y2={padTop + plotH} className="axis-line" />
        {Array.from({ length: steps + 1 }, (_, i) => {
          const v = (max / steps) * i;
          const y = yFor(v);
          return (
            <g key={i}>
              {i > 0 && (
                <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" />
              )}
              <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="10">
                {fmt(v)}
              </text>
            </g>
          );
        })}
        {(() => {
          // カテゴリが多いとラベルが重なるため、間引いて表示する（最後の点は必ず表示）
          const maxLabels = 12;
          const step = Math.max(1, Math.ceil(categories.length / maxLabels));
          return categories.map((c, i) => {
            const isLast = i === categories.length - 1;
            if (i % step !== 0 && !isLast) return null;
            return (
              <text key={c} x={xFor(i)} y={height - 14} textAnchor="middle" fontSize="10.5">
                {c}
              </text>
            );
          });
        })()}
        {series.map((s) => {
          const points = s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
          const lastIdx = s.values.length - 1;
          return (
            <g key={s.key}>
              <polyline points={points} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={xFor(i)} cy={yFor(v)} r={i === lastIdx ? 4 : 2.5} fill={s.color}>
                  <title>
                    {s.label} {categories[i]}：{fmt(v)}
                    {unit}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <div className="legend-item" key={s.key}>
              <span className="legend-swatch" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
