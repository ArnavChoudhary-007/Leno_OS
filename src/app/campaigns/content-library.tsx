"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { EditorDrawer, type EditorDraft } from "@/components/leno/editor-drawer";
import { PlatformPill } from "@/components/leno/platform-pill";
import type { FeedAuthor } from "@/components/leno/feed-preview";
import { reviewDraftOrThrow } from "@/lib/review-draft";
import {
  draftStage,
  platformLabel,
  stageBadgeClass,
} from "@/lib/workspace-ui";
import type { CritiqueScores, DraftStatus } from "@/shared/types";

export type LibraryPost = {
  id: string;
  campaign_id: string;
  platform: string;
  body: string;
  hashtags: string[];
  status: DraftStatus;
  score: number | null;
  scores: CritiqueScores | null;
  scheduled_at: string | null;
  published_url: string | null;
  image_url: string | null;
  created_at: string;
  campaign_brief: string;
  campaign_goal: string | null;
};

const STATUS_TABS = ["All", "Review", "Scheduled", "Published", "Draft"] as const;

function matchesTab(post: LibraryPost, tab: (typeof STATUS_TABS)[number]): boolean {
  const stage = draftStage(post);
  if (tab === "All") return true;
  if (tab === "Review") return stage === "Review";
  if (tab === "Scheduled") return stage === "Scheduled";
  if (tab === "Published") return stage === "Published";
  return stage === "Generated" || stage === "Validated";
}

export function ContentLibrary({
  posts,
  canMutate,
  author,
  initialStatus,
  initialQuery,
}: {
  posts: LibraryPost[];
  canMutate: boolean;
  author: FeedAuthor;
  initialStatus?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>(
    STATUS_TABS.includes(initialStatus as (typeof STATUS_TABS)[number])
      ? (initialStatus as (typeof STATUS_TABS)[number])
      : "All",
  );
  const [platform, setPlatform] = useState("all");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditorDraft | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (!matchesTab(post, tab)) return false;
      if (platform !== "all" && post.platform !== platform) return false;
      if (!q) return true;
      return `${post.body} ${post.campaign_brief} ${post.campaign_goal ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [posts, tab, platform, query]);

  const counts = useMemo(() => {
    const next: Record<string, number> = { All: posts.length };
    for (const t of STATUS_TABS) {
      if (t === "All") continue;
      next[t] = posts.filter((p) => matchesTab(p, t)).length;
    }
    return next;
  }, [posts]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function refresh() {
    router.refresh();
    setSelected(new Set());
  }

  function bulk(fn: (post: LibraryPost) => Promise<void>, label: string) {
    startTransition(async () => {
      const rows = filtered.filter((p) => selected.has(p.id));
      try {
        for (const row of rows) await fn(row);
        toast.success(`${label} ${rows.length} posts`);
        refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk action failed");
      }
    });
  }

  return (
    <div className="content-page-container">
      <div className="content-filter-bar">
        <div className="filter-left-group">
          {STATUS_TABS.map((item) => (
            <button
              key={item}
              type="button"
              className={`filter-status-tab${tab === item ? " active" : ""}`}
              onClick={() => setTab(item)}
            >
              <span>{item === "Draft" ? "Drafts" : item}</span>
              <span className="status-count-pill">{counts[item] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="filter-right-group">
          <select
            className="input-field"
            style={{ height: 34, padding: "0 8px", fontSize: "0.82rem" }}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="all">All Platforms</option>
            <option value="linkedin">LinkedIn</option>
            <option value="instagram">Instagram</option>
            <option value="x">Twitter / X</option>
            <option value="threads">Threads</option>
          </select>
          <div className="cms-search-box">
            <input
              className="cms-search-input"
              placeholder="Search posts, hooks..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {canMutate && selected.size > 0 ? (
        <div className="bulk-actions-bar active">
          <div className="bulk-actions-left">
            <span>{selected.size} selected</span>
            <span>• Actions:</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm btn-accent"
              disabled={pending}
              onClick={() =>
                bulk(
                  (post) =>
                    reviewDraftOrThrow(post.campaign_id, post.id, { action: "approve" }),
                  "Approved",
                )
              }
            >
              Approve Selected
            </button>
            <button
              type="button"
              className="btn btn-sm btn-destructive"
              disabled={pending}
              onClick={() =>
                bulk(
                  (post) =>
                    reviewDraftOrThrow(post.campaign_id, post.id, { action: "delete" }),
                  "Deleted",
                )
              }
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="card">
          <p className="card-title">No posts match</p>
          <p className="card-subtitle">Try another filter, or generate content from a brief.</p>
        </div>
      ) : (
        <div className="content-table-wrapper">
          <table className="content-table">
            <thead>
              <tr>
                <th className="cell-checkbox">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(filtered.map((p) => p.id)));
                      else setSelected(new Set());
                    }}
                  />
                </th>
                <th>Content Asset</th>
                <th>Platform</th>
                <th>Status</th>
                <th>Author / Agent</th>
                <th>Schedule / Publish</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post) => {
                const stage = draftStage(post);
                return (
                  <tr key={post.id} className="content-table-row">
                    <td className="cell-checkbox">
                      <input
                        type="checkbox"
                        checked={selected.has(post.id)}
                        onChange={(e) => toggle(post.id, e.target.checked)}
                      />
                    </td>
                    <td>
                      <Link href={`/campaigns/${post.campaign_id}`} className="cell-content-meta">
                        <div>
                          <p className="content-row-title">
                            {post.campaign_goal ?? post.body.slice(0, 80)}
                          </p>
                          <p className="card-subtitle">{post.body.slice(0, 100)}</p>
                        </div>
                      </Link>
                    </td>
                    <td>
                      <PlatformPill platform={post.platform} />
                    </td>
                    <td>
                      <span className={`badge ${stageBadgeClass(stage)}`}>
                        <span className="badge-dot" />
                        {stage}
                      </span>
                    </td>
                    <td>{platformLabel(post.platform)} Agent</td>
                    <td>
                      {post.published_url ? (
                        <a href={post.published_url} target="_blank" rel="noreferrer">
                          Live
                        </a>
                      ) : post.scheduled_at ? (
                        new Date(post.scheduled_at).toLocaleString()
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-subtle"
                        onClick={() => setEditing(post)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <EditorDrawer
        draft={editing}
        author={author}
        canMutate={canMutate}
        onClose={() => setEditing(null)}
        onChanged={refresh}
      />
    </div>
  );
}
