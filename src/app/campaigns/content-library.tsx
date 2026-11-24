"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CloseIcon } from "@/components/app-chrome";
import { EditorDrawer, type EditorDraft, type FeedAuthor } from "@/components/leno/editor-drawer";
import { reviewDraftOrThrow } from "@/lib/review-draft";
import {
  CREATE_PLATFORMS,
  canApproveDraft,
  canEditDraft,
  isWaiting,
  platformLabel,
  postHook,
  postStage,
  postTitle,
  relativeTime,
  shortDateTime,
  statusBadgeClass,
  statusWord,
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
  publish_error: string | null;
  created_at: string;
  campaign_brief: string;
  campaign_goal: string | null;
};

export const STATUS_TABS = ["All", "Waiting", "Approved", "Scheduled", "Publishing", "Needs check", "Published"] as const;
export type StatusTab = (typeof STATUS_TABS)[number];

function matchesTab(post: LibraryPost, tab: StatusTab): boolean {
  if (tab === "All") return true;
  if (tab === "Waiting") return isWaiting(post);
  if (tab === "Needs check") return post.status === "publish_failed";
  return postStage(post) === tab;
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
  const [tab, setTab] = useState<StatusTab>(
    STATUS_TABS.includes(initialStatus as StatusTab) ? (initialStatus as StatusTab) : "All",
  );
  const [platform, setPlatform] = useState("all");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (!matchesTab(post, tab)) return false;
      if (platform !== "all" && post.platform !== platform) return false;
      if (!q) return true;
      return `${post.body} ${post.campaign_brief} ${post.campaign_goal ?? ""}`.toLowerCase().includes(q);
    });
  }, [posts, tab, platform, query]);

  const counts = useMemo(() => {
    const next = {} as Record<StatusTab, number>;
    for (const t of STATUS_TABS) next[t] = posts.filter((p) => matchesTab(p, t)).length;
    return next;
  }, [posts]);

  const chosen = filtered.filter((p) => selected.has(p.id));
  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function pickTab(t: StatusTab) {
    setTab(t);
    setSelected(new Set());
    const url = new URL(window.location.href);
    if (t === "All") url.searchParams.delete("status");
    else url.searchParams.set("status", t);
    window.history.replaceState(null, "", url);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(rows: LibraryPost[], fn: (post: LibraryPost) => Promise<void>, verb: string) {
    startTransition(async () => {
      let done = 0;
      try {
        for (const row of rows) {
          await fn(row);
          done += 1;
        }
        toast.success(`${verb} ${done} post${done === 1 ? "" : "s"}`);
      } catch (err) {
        toast.error(
          `${done ? `${verb} ${done}, then: ` : ""}${err instanceof Error ? err.message : "Action failed"}`,
        );
      } finally {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const approvable = chosen.filter((p) => canApproveDraft(p.status));
  const deletable = chosen.filter((p) => canEditDraft(p.status));

  return (
    <>
      <div className="l-filters">
        <div role="tablist" aria-label="Status" className="l-tabs">
          {STATUS_TABS.map((t) => (
            <button key={t} type="button" role="tab" className="l-tab" aria-selected={tab === t} onClick={() => pickTab(t)}>
              {t} <span className="mono">{counts[t]}</span>
            </button>
          ))}
        </div>
        <label htmlFor="plat" className="sr-only-l">
          Platform
        </label>
        <select id="plat" className="l-input" value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ fontSize: 14 }}>
          <option value="all">All platforms</option>
          {CREATE_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </select>
        <label htmlFor="q" className="sr-only-l">
          Search posts
        </label>
        <input
          id="q"
          type="search"
          className="l-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts"
          style={{ flex: "1 1 200px", fontSize: 14 }}
        />
      </div>

      <div className="l-table-box">
        <div className="l-table-wrap">
          <table className="l-table" style={{ minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--l-line)" }}>
                {canMutate ? (
                  <th style={{ width: 48, paddingLeft: 20 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={allChecked}
                      onChange={() => setSelected(allChecked ? new Set() : new Set(filtered.map((p) => p.id)))}
                    />
                  </th>
                ) : null}
                <th style={canMutate ? undefined : { paddingLeft: 20 }}>Post</th>
                <th>Platform</th>
                <th>Status</th>
                <th>When</th>
                <th style={{ textAlign: "right", paddingRight: 20 }}>
                  <span className="sr-only-l">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post) => {
                const on = selected.has(post.id);
                const when = post.published_url
                  ? "Live"
                  : post.scheduled_at && post.status === "approved"
                    ? shortDateTime(post.scheduled_at)
                    : relativeTime(post.created_at);
                return (
                  <tr key={post.id} className={on ? "is-selected" : undefined}>
                    {canMutate ? (
                      <td style={{ paddingLeft: 20 }}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${postTitle(post)} (${platformLabel(post.platform)})`}
                          checked={on}
                          onChange={() => toggle(post.id)}
                        />
                      </td>
                    ) : null}
                    <td style={{ maxWidth: 420, ...(canMutate ? {} : { paddingLeft: 20 }) }}>
                      <Link href={`/campaigns/${post.campaign_id}`} className="l-row-link l-post-cell">
                        <span style={{ fontWeight: 500 }} className="l-clip">
                          {postTitle(post)}
                        </span>
                        <span className="l-faint l-clip" style={{ fontSize: 14 }}>
                          {postHook(post.body)}
                        </span>
                      </Link>
                    </td>
                    <td className="l-muted">{platformLabel(post.platform)}</td>
                    <td>
                      <span className={statusBadgeClass(post)}>{statusWord(post)}</span>
                    </td>
                    <td className="l-muted" style={{ fontSize: 14 }}>
                      {post.published_url ? (
                        <a href={post.published_url} target="_blank" rel="noreferrer" className="l-link-lime">
                          Live
                        </a>
                      ) : (
                        when
                      )}
                    </td>
                    <td style={{ textAlign: "right", paddingRight: 20 }}>
                      <button type="button" className="l-btn l-btn-ghost l-btn-sm" onClick={() => setEditing({ id: post.id })}>
                        {canMutate && canEditDraft(post.status) ? "Edit" : "View"}
                      </button>
                      {post.status === "publish_failed" ? (
                        <Link href={`/campaigns/${post.campaign_id}`} className="l-btn l-btn-ghost l-btn-sm">
                          Reconcile
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <p style={{ margin: 0, padding: "48px 20px", color: "var(--l-text-4)", fontSize: 15 }}>
            No posts match these filters
          </p>
        ) : null}
      </div>

      {canMutate && chosen.length > 0 ? (
        <div className="l-bulk" role="region" aria-label="Bulk actions">
          <span className="l-bulk-count">{chosen.length} selected</span>
          <button
            type="button"
            className="l-btn l-btn-lime"
            disabled={pending || approvable.length === 0}
            onClick={() =>
              bulk(approvable, (p) => reviewDraftOrThrow(p.campaign_id, p.id, { action: "approve" }), "Approved")
            }
          >
            Approve{approvable.length && approvable.length !== chosen.length ? ` ${approvable.length}` : ""}
          </button>
          <button
            type="button"
            className="l-btn l-bulk-delete"
            disabled={pending || deletable.length === 0}
            onClick={() => {
              if (!window.confirm(`Delete ${deletable.length} post${deletable.length === 1 ? "" : "s"}? This can’t be undone.`)) return;
              bulk(deletable, (p) => reviewDraftOrThrow(p.campaign_id, p.id, { action: "delete" }), "Deleted");
            }}
          >
            Delete
          </button>
          <button type="button" className="l-bulk-x" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
            <CloseIcon size={14} />
          </button>
        </div>
      ) : null}

      <EditorDrawer
        key={editing?.id ?? "closed"}
        drafts={posts.filter((p) => p.id === editing?.id) as EditorDraft[]}
        openId={editing?.id ?? null}
        author={author}
        canMutate={canMutate}
        onClose={() => setEditing(null)}
        onChanged={() => router.refresh()}
      />
    </>
  );
}
