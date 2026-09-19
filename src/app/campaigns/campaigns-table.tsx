"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CampaignStatus } from "@/shared/types";

export type CampaignListItem = {
  id: string;
  brief: string;
  goal: string | null;
  status: CampaignStatus;
  created_at: string;
};

function statusLabel(status: CampaignStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "ready":
      return "Ready";
    case "needs_human":
      return "Needs review";
    case "failed":
      return "Failed";
  }
}

function statusBadge(status: CampaignStatus): string {
  switch (status) {
    case "queued":
      return "badge-neutral";
    case "running":
      return "badge-purple";
    case "ready":
      return "badge-green";
    case "needs_human":
      return "badge-amber";
    case "failed":
      return "badge-red";
  }
}

const FILTERS: { id: "all" | CampaignStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "needs_human", label: "Review" },
  { id: "ready", label: "Ready" },
  { id: "failed", label: "Failed" },
];

export function CampaignsTable({
  campaigns,
}: {
  campaigns: CampaignListItem[];
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: campaigns.length };
    for (const campaign of campaigns) {
      next[campaign.status] = (next[campaign.status] ?? 0) + 1;
    }
    return next;
  }, [campaigns]);

  const rows = campaigns.filter((campaign) => {
    if (filter !== "all" && campaign.status !== filter) return false;
    if (!query.trim()) return true;
    const hay = `${campaign.goal ?? ""} ${campaign.brief}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  return (
    <div className="content-page-container">
      <div className="content-filter-bar">
        <div className="filter-left-group">
          {FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`filter-status-tab${filter === tab.id ? " active" : ""}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span className="status-count-pill">{counts[tab.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="filter-right-group">
          <label className="cms-search-box">
            <span className="sr-only">Search campaigns</span>
            <input
              className="cms-search-input"
              placeholder="Search briefs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <p className="card-title">No campaigns match</p>
          <p className="card-subtitle">
            Try another filter, or start a run from a new brief.
          </p>
        </div>
      ) : (
        <div className="content-table-wrapper">
          <table className="content-table">
            <colgroup>
              <col className="col-campaign" />
              <col className="col-status" />
              <col className="col-created" />
            </colgroup>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((campaign) => (
                <tr key={campaign.id} className="content-table-row">
                  <td>
                    <Link href={`/campaigns/${campaign.id}`} className="cell-content-meta">
                      <div>
                        <p className="content-row-title">
                          {campaign.goal ?? campaign.brief}
                        </p>
                        {campaign.goal ? (
                          <p className="card-subtitle">{campaign.brief}</p>
                        ) : null}
                      </div>
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(campaign.status)}`}>
                      <span className="badge-dot" />
                      {statusLabel(campaign.status)}
                    </span>
                  </td>
                  <td>
                    {new Date(campaign.created_at).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
