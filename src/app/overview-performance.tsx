"use client";

import { useMemo, useState } from "react";
import { OverviewBarChart } from "@/components/leno/bar-chart";
import type { ChartPoint } from "@/lib/workspace-ui";

export function OverviewPerformance({
  impressions,
  engagement,
  clicks,
  posts,
}: {
  impressions: ChartPoint[];
  engagement: ChartPoint[];
  clicks: ChartPoint[];
  posts: ChartPoint[];
}) {
  const [metric, setMetric] = useState<"impressions" | "engagement" | "clicks" | "posts">(
    "posts",
  );
  const series = useMemo(() => {
    switch (metric) {
      case "impressions":
        return impressions;
      case "engagement":
        return engagement;
      case "clicks":
        return clicks;
      default:
        return posts;
    }
  }, [metric, impressions, engagement, clicks, posts]);

  return (
    <>
      <div className="performance-header-row">
        <span className="performance-title">Content Performance</span>
        <div id="overviewChartTabs" className="tab-switcher">
          {(
            [
              ["impressions", "Impressions"],
              ["engagement", "Engagement"],
              ["clicks", "Clicks"],
              ["posts", "Posts"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab-switcher-btn${metric === id ? " active" : ""}`}
              onClick={() => setMetric(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <OverviewBarChart points={series} />
    </>
  );
}
