type Bar = { key: string; label: string; color: string; value: number };

export default function BarList({ bars, valueFormatter }: { bars: Bar[]; valueFormatter: (v: number) => string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const trackWidth = 230;

  return (
    <svg className="chart-svg" viewBox={`0 0 320 ${bars.length * 48}`} width="100%" height={bars.length * 48}>
      {bars.map((b, i) => {
        const y = i * 48;
        const w = Math.max(3, (b.value / max) * trackWidth);
        return (
          <g key={b.key}>
            <text x={0} y={y + 12} fontSize="11.5" fontWeight="700" fill={b.color}>
              {b.label}
            </text>
            <rect x={0} y={y + 18} width={w} height={16} rx={4} fill={b.color}>
              <title>{valueFormatter(b.value)}</title>
            </rect>
            <text x={w + 8} y={y + 30} fontSize="11" className="val-label">
              {valueFormatter(b.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
