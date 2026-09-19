"use client";

import { useState } from "react";
import type { ChartPoint } from "@/lib/workspace-ui";

export function OverviewBarChart({ points }: { points: ChartPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 580;
  const height = 160;
  const paddingBottom = 22;
  const paddingTop = 12;
  const chartHeight = height - paddingBottom - paddingTop;
  const data = points.length > 0 ? points : [{ date: "—", val: 0 }];
  const maxVal = Math.max(...data.map((d) => d.val), 1) * 1.15;
  const barWidth = Math.max(6, Math.min(18, (width / data.length) * 0.45));
  const step = width / data.length;
  const active = hover != null ? data[hover] : data.find((p) => p.highlight);

  return (
    <div className="chart-container-box" style={{ position: "relative" }}>
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line
          x1="0"
          y1={height - paddingBottom}
          x2={width}
          y2={height - paddingBottom}
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1"
        />
        {data.map((item, idx) => {
          const barH = (item.val / maxVal) * chartHeight;
          const x = idx * step + step / 2 - barWidth / 2;
          const y = height - paddingBottom - barH;
          const highlighted = item.highlight || hover === idx;
          return (
            <g key={`${item.date}-${idx}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barH, 2)}
                rx={barWidth / 2}
                fill={highlighted ? "#ffffff" : "rgba(255, 255, 255, 0.75)"}
                opacity={highlighted ? 1 : 0.55}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(idx)}
                onMouseLeave={() => setHover(null)}
              />
              {idx % 3 === 0 || idx === data.length - 1 || item.highlight ? (
                <text
                  x={x + barWidth / 2}
                  y={height - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="rgba(255, 255, 255, 0.7)"
                >
                  {item.date}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {active ? (
        <div className="chart-tooltip-badge" style={{ display: "flex" }}>
          <div className="chart-tooltip-value">{active.label ?? active.val}</div>
          <div className="chart-tooltip-date">{active.date}</div>
        </div>
      ) : null}
    </div>
  );
}
