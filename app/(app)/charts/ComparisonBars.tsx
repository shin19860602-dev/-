import { niceMax } from "@/lib/analytics";

export default function ComparisonBars({
  categories,
  current,
  previous,
  currentLabel,
  previousLabel,
  valueFormatter,
}: {
  categories: string[];
  current: number[];
  previous: number[];
  currentLabel: string;
  previousLabel: string;
  valueFormatter: (v: number) => string;
}) {
  const width = 560;
  const height = 220;
  const padTop = 24;
  const padBottom = 34;
  const padLeft = 8;
  const padRight = 8;
  const plotH = height - padTop - padBottom;
  const plotW = width - padLeft - padRight;
  const max = niceMax(Math.max(1, ...current, ...previous));

  const groupWidth = plotW / categories.length;
  const barWidth = Math.min(46, groupWidth * 0.28);
  const gap = 6;

  const yFor = (v: number) => padTop + plotH - (v / max) * plotH;
  const barBase = padTop + plotH;

  return (
    <div>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
        <line x1={padLeft} y1={barBase} x2={width - padRight} y2={barBase} className="axis-line" />
        {categories.map((cat, i) => {
          const cx = padLeft + groupWidth * i + groupWidth / 2;
          const curX = cx - barWidth - gap / 2;
          const prevX = cx + gap / 2;
          const curY = yFor(current[i]);
          const prevY = yFor(previous[i]);
          return (
            <g key={cat}>
              <rect x={curX} y={curY} width={barWidth} height={barBase - curY} rx={4} fill="var(--accent)">
                <title>
                  {cat}（{currentLabel}）：{valueFormatter(current[i])}
                </title>
              </rect>
              <text x={curX + barWidth / 2} y={curY - 6} textAnchor="middle" fontSize="10.5" className="val-label">
                {valueFormatter(current[i])}
              </text>

              <rect x={prevX} y={prevY} width={barWidth} height={barBase - prevY} rx={4} fill="var(--text-faint)">
                <title>
                  {cat}（{previousLabel}）：{valueFormatter(previous[i])}
                </title>
              </rect>
              <text x={prevX + barWidth / 2} y={prevY - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-dim)">
                {valueFormatter(previous[i])}
              </text>

              <text x={cx} y={height - 12} textAnchor="middle" fontSize="11.5">
                {cat}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <div className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--accent)" }} />
          {currentLabel}
        </div>
        <div className="legend-item">
          <span className="legend-swatch" style={{ background: "var(--text-faint)" }} />
          {previousLabel}
        </div>
      </div>
    </div>
  );
}
