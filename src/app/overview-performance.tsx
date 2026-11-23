"use client";

import { useMemo, useState } from "react";
import { bucketByDay } from "@/lib/workspace-ui";

export type ActivityRow = {
  created_at: string;
  status: string;
  scheduled_at: string | null;
};

const METRICS = [
  { id: "written", label: "Written", noun: "posts written" },
  { id: "approved", label: "Approved", noun: "posts approved or live" },
  { id: "scheduled", label: "Scheduled", noun: "posts scheduled" },
  { id: "published", label: "Published", noun: "posts published" },
] as const;

type MetricId = (typeof METRICS)[number]["id"];

function matches(row: ActivityRow, metric: MetricId): boolean {
  switch (metric) {
    case "written":
      return true;
    case "approved":
      return row.status === "approved" || row.status === "published";
    case "scheduled":
      return row.status === "approved" && row.scheduled_at !== null;
    case "published":
      return row.status === "published";
  }
}

/** Bar chart of workspace output by day, by metric and range. */
export function OverviewPerformance({ rows }: { rows: ActivityRow[] }) {
  const [metric, setMetric] = useState<MetricId>("written");
  const [days, setDays] = useState(30);
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(
    () => bucketByDay(rows.filter((r) => matches(r, metric)).map((r) => r.created_at), days),
    [rows, metric, days],
  );
  const total = series.reduce((sum, p) => sum + p.val, 0);
  const max = Math.max(1, ...series.map((p) => p.val));
  const meta = METRICS.find((m) => m.id === metric)!;
  const focus = hover !== null ? series[hover] : null;
  const mid = series[Math.floor(series.length / 2)];

  return (
    <section aria-labelledby="perf-h" className="l-card l-perf">
      <div className="l-perf-head">
        <h2 id="perf-h" className="l-card-title" style={{ marginRight: "auto" }}>
          Content performance
        </h2>
        <div role="tablist" aria-label="Metric" className="l-tabs l-tabs-deep">
          {METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              className="l-tab"
              aria-selected={metric === m.id}
              onClick={() => setMetric(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label htmlFor="range" className="sr-only-l">
          Date range
        </label>
        <select
          id="range"
          className="l-input l-input-deep"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{ fontSize: 14 }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>
      <div className="l-perf-focus">
        <span className="l-num l-lime" style={{ fontSize: 48 }}>
          {focus ? focus.val : total}
        </span>
        <span className="l-muted" style={{ fontSize: 15 }}>
          {focus ? `${meta.noun} on ${focus.date}` : `${meta.noun} in the last ${days} days`}
        </span>
      </div>
      <div className="l-bars" onMouseLeave={() => setHover(null)}>
        {series.map((p, i) => (
          <button
            key={p.date}
            type="button"
            className={`l-bar${hover === i ? " is-on" : ""}`}
            aria-label={`${p.date}: ${p.val} ${meta.noun}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            style={{ height: `${p.val === 0 ? 2 : Math.max(6, (p.val / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="l-axis">
        <span>{series[0]?.date}</span>
        <span>{mid?.date}</span>
        <span>Today</span>
      </div>
    </section>
  );
}
