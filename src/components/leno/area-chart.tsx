import type { ChartPoint } from "@/lib/workspace-ui";

export function AnalyticsAreaChart({ points }: { points: ChartPoint[] }) {
  const width = 920;
  const height = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 12 };
  const data = points.length > 0 ? points : [{ date: "—", val: 0 }];
  const maxVal = Math.max(...data.map((d) => d.val), 1) * 1.15;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const coords = data.map((item, idx) => {
    const x = pad.left + (idx / Math.max(data.length - 1, 1)) * innerW;
    const y = pad.top + innerH - (item.val / maxVal) * innerH;
    return { x, y, item };
  });
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${coords[coords.length - 1]?.x ?? pad.left} ${pad.top + innerH} L ${pad.left} ${pad.top + innerH} Z`;

  return (
    <svg id="analyticsAreaSvg" className="analytics-area-svg" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#analyticsFill)" />
      <path d={line} fill="none" stroke="var(--accent-primary)" strokeWidth="2.4" />
      {coords.map((c, idx) =>
        idx % 3 === 0 || idx === coords.length - 1 ? (
          <text
            key={c.item.date + idx}
            x={c.x}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-muted)"
          >
            {c.item.date}
          </text>
        ) : null,
      )}
    </svg>
  );
}
