"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { bucketByDay, draftWindow, platformLabel, relativeTime } from "@/lib/workspace-ui";

export type AnalyticsRow = {
  id: string;
  campaign_id: string;
  created_at: string;
  published_at: string | null;
  platform: string;
  status: string;
  score: number | null;
  title: string;
};

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

/**
 * What the workspace produced and shipped. Leno doesn't read third-party
 * impressions yet, so every number here comes from its own records.
 */
export function AnalyticsView({ rows }: { rows: AnalyticsRow[] }) {
  const [days, setDays] = useState<number>(30);
  // Pin "now" once per mount so filtering stays a pure function of state.
  const [now] = useState(() => Date.now());

  // Written = created in the window; published = actually went live in it.
  const { created: inRange, published: publishedRows } = useMemo(
    () => draftWindow(rows, days, new Date(now)),
    [rows, days, now],
  );

  const published = publishedRows.length;
  const approved = inRange.filter((r) => r.status === "approved" || r.status === "published").length;
  const scored = inRange.filter((r) => r.score != null);
  const avgScore = scored.length ? scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length : null;

  const totals = [
    { label: "Posts written", value: String(inRange.length), note: `in the last ${days} days`, lime: true },
    { label: "Published", value: String(published), note: "confirmed live in this window", lime: false },
    {
      label: "Approval rate",
      value: inRange.length ? `${Math.round((approved / inRange.length) * 100)}%` : "—",
      note: "approved or live",
      lime: false,
    },
    { label: "Average critic score", value: avgScore != null ? avgScore.toFixed(2) : "—", note: "passes at 0.80", lime: false },
  ];

  const series = useMemo(
    () => bucketByDay(inRange.map((r) => r.created_at), days, new Date(now)),
    [inRange, days, now],
  );
  const max = Math.max(1, ...series.map((p) => p.val));
  const step = series.length > 1 ? 1000 / (series.length - 1) : 1000;
  const pts = series.map((p, i) => [i * step, 236 - (p.val / max) * 210] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L1000,240 L0,240 Z`;

  const byPlatform = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of inRange) counts.set(r.platform, (counts.get(r.platform) ?? 0) + 1);
    const top = Math.max(1, ...counts.values());
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([platform, count], i) => ({
        platform,
        count,
        pct: Math.round((count / top) * 100),
        lime: i === 0,
      }));
  }, [inRange]);

  const top = [...scored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);

  return (
    <div className="l-page">
      <div className="l-page-header">
        <div className="l-page-header-text">
          <h1 className="l-h1">Analytics</h1>
        </div>
        <div role="tablist" aria-label="Date range" className="l-tabs">
          {RANGES.map((r) => (
            <button key={r.days} type="button" role="tab" className="l-tab" aria-selected={days === r.days} onClick={() => setDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <section aria-labelledby="out-h" className="l-card l-perf" style={{ padding: 28 }}>
        <div className="l-totals">
          {totals.map((t) => (
            <div key={t.label} className="l-total">
              <span className="l-muted" style={{ fontSize: 14 }}>
                {t.label}
              </span>
              <span className={`l-num${t.lime ? " l-lime" : ""}`} style={{ fontSize: 44 }}>
                {t.value}
              </span>
              <span className="l-faint" style={{ fontSize: 13 }}>
                {t.note}
              </span>
            </div>
          ))}
        </div>
        <h2 id="out-h" className="sr-only-l">
          Posts written per day
        </h2>
        <svg
          role="img"
          aria-label={`Posts written per day over the last ${days} days, ${inRange.length} in total, busiest day ${max === 1 && inRange.length === 0 ? "none" : max}`}
          viewBox="0 0 1000 240"
          preserveAspectRatio="none"
          className="l-area"
        >
          <line x1="0" y1="60" x2="1000" y2="60" stroke="#1F1F1F" strokeWidth="1" />
          <line x1="0" y1="120" x2="1000" y2="120" stroke="#1F1F1F" strokeWidth="1" />
          <line x1="0" y1="180" x2="1000" y2="180" stroke="#1F1F1F" strokeWidth="1" />
          <path d={area} fill="#C8FF1A" fillOpacity="0.12" />
          <path d={line} fill="none" stroke="#C8FF1A" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="l-axis">
          <span>{series[0]?.date}</span>
          <span>Today</span>
        </div>
      </section>

      <div className="l-two">
        <section aria-labelledby="pl-h" className="l-card l-stack-18">
          <h2 id="pl-h" className="l-card-title">
            By platform
          </h2>
          {byPlatform.length === 0 ? (
            <p className="l-muted" style={{ margin: 0 }}>
              Nothing written in this range.
            </p>
          ) : (
            byPlatform.map((p) => (
              <div key={p.platform} className="l-stack-8">
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                  <span>{platformLabel(p.platform)}</span>
                  <span className="mono l-muted">
                    {p.count} post{p.count === 1 ? "" : "s"}
                  </span>
                </div>
                <span aria-hidden="true" className="l-meter">
                  <span style={{ width: `${p.pct}%`, background: p.lime ? "var(--l-lime)" : "var(--l-text)" }} />
                </span>
              </div>
            ))
          )}
        </section>
        <section aria-labelledby="tp-h" className="l-card" style={{ display: "flex", flexDirection: "column" }}>
          <h2 id="tp-h" className="l-card-title" style={{ marginBottom: 12 }}>
            Top posts by critic score
          </h2>
          {top.length === 0 ? (
            <p className="l-muted" style={{ margin: 0 }}>
              No scored posts in this range.
            </p>
          ) : (
            top.map((t, i) => (
              <Link key={t.id} href={`/track?post=${t.id}`} className="l-top-row">
                <span className="mono l-faint">{i + 1}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span className="l-clip" style={{ fontSize: 15, fontWeight: 500 }}>
                    {t.title}
                  </span>
                  <span className="l-faint" style={{ fontSize: 13 }}>
                    {platformLabel(t.platform)} · {relativeTime(t.created_at)}
                  </span>
                </span>
                <span className="mono" style={{ fontSize: 15 }}>
                  {(t.score ?? 0).toFixed(2)}
                </span>
              </Link>
            ))
          )}
        </section>
      </div>
      <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
        Counts come from Leno’s own records. Views and engagement from each platform aren’t connected yet.
      </p>
    </div>
  );
}
