"use client";

import { useMemo, useState } from "react";
import { AnalyticsAreaChart } from "@/components/leno/area-chart";
import { PlatformPill } from "@/components/leno/platform-pill";
import { bucketByDay, type ChartPoint } from "@/lib/workspace-ui";

export type AnalyticsRow = {
  created_at: string;
  platform: string;
  status: string;
  title: string;
};

export function AnalyticsView({ rows }: { rows: AnalyticsRow[] }) {
  const [range, setRange] = useState<"7" | "30" | "90">("30");
  const days = Number(range);

  const published = rows.filter((r) => r.status === "published");
  const series: ChartPoint[] = useMemo(
    () => bucketByDay(rows.map((r) => r.created_at), days),
    [rows, days],
  );

  const byPlatform = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.platform] = (counts[row.platform] ?? 0) + 1;
    }
    const total = rows.length || 1;
    return Object.entries(counts)
      .map(([platform, count]) => ({
        platform,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const colors: Record<string, string> = {
    linkedin: "#0a66c2",
    x: "#0f1419",
    instagram: "#e1306c",
    threads: "#000000",
    facebook: "#1877f2",
  };

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Performance Analytics</h2>
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginTop: 2 }}>
            Workspace output by platform — published posts, not third-party impressions.
          </p>
        </div>
        <div className="tab-nav">
          {(["7", "30", "90"] as const).map((id) => (
            <button
              key={id}
              type="button"
              className={`tab-nav-btn analytics-range-btn${range === id ? " active" : ""}`}
              onClick={() => setRange(id)}
            >
              {id} Days
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-kpi-grid">
        <Kpi label="Posts created" value={String(rows.length)} />
        <Kpi label="Published" value={String(published.length)} />
        <Kpi
          label="Publish rate"
          value={rows.length ? `${Math.round((published.length / rows.length) * 100)}%` : "—"}
        />
        <Kpi label="Platforms used" value={String(byPlatform.length)} />
        <Kpi label="Window" value={`${range} days`} />
      </div>

      <div className="analytics-chart-card">
        <div className="chart-card-top">
          <div>
            <strong style={{ fontSize: "1.05rem" }}>Output over time</strong>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Drafts generated across LinkedIn, Instagram, X, and Threads
            </div>
          </div>
          <span className="badge badge-blue">Activity chart</span>
        </div>
        <AnalyticsAreaChart points={series} />
      </div>

      <div className="analytics-split-grid">
        <div className="platform-share-card">
          <strong style={{ fontSize: "1rem" }}>Distribution by Platform</strong>
          {byPlatform.length === 0 ? (
            <p className="card-subtitle" style={{ marginTop: 12 }}>
              No posts yet.
            </p>
          ) : (
            byPlatform.map((row) => (
              <div key={row.platform} className="share-progress-row">
                <div className="share-row-header">
                  <span>{row.platform}</span>
                  <strong>
                    {row.pct}% ({row.count})
                  </strong>
                </div>
                <div className="share-bar-track">
                  <div
                    className="share-bar-fill"
                    style={{
                      width: `${row.pct}%`,
                      background: colors[row.platform] ?? "var(--accent-primary)",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <div className="platform-share-card">
          <strong style={{ fontSize: "1rem" }}>Top Performing Assets</strong>
          <table className="top-content-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Content</th>
                <th>Channel</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {published.slice(0, 6).map((post, idx) => (
                <tr key={`${post.title}-${idx}`}>
                  <td style={{ fontWeight: 700, color: "var(--text-muted)" }}>#{idx + 1}</td>
                  <td>{post.title.slice(0, 48)}</td>
                  <td>
                    <PlatformPill platform={post.platform} />
                  </td>
                  <td>
                    <span className="badge badge-green">Published</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-stat-card">
      <div className="kpi-stat-header">
        <span className="kpi-stat-label">{label}</span>
      </div>
      <span className="kpi-stat-value">{value}</span>
    </div>
  );
}
