"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PLATFORM_PLAYBOOKS, composeDraftExport, composePost } from "@/agents/platforms";
import { splitInstagramBody } from "@/agents/platforms/instagram-rules";
import { DraftCreative } from "@/app/campaigns/[id]/draft-creative";
import { CloseIcon } from "@/components/app-chrome";
import { Drawer } from "@/components/leno/drawer";
import { reviewDraftOrThrow } from "@/lib/review-draft";
import { canApproveDraft, canEditDraft, nativePublishDestination, platformLabel } from "@/lib/workspace-ui";
import type { CritiqueScores, DraftStatus, PlatformId } from "@/shared/types";

export type EditorDraft = {
  id: string;
  campaign_id: string;
  platform: string;
  body: string;
  hashtags: string[];
  status: DraftStatus;
  score: number | null;
  scores: CritiqueScores | null;
  scheduled_at: string | null;
  image_url: string | null;
  publish_error?: string | null;
};

export type FeedAuthor = {
  name: string;
  handle: string;
};

const CRITERIA: { key: keyof CritiqueScores; label: string }[] = [
  { key: "brand_voice", label: "Brand voice" },
  { key: "goal_fit", label: "Goal fit" },
  { key: "platform_fit", label: "Platform fit" },
  { key: "craft", label: "Craft" },
];

/**
 * Edit one post with a live preview and the critic's scorecard. When given
 * several drafts, tabs switch between them (Create page); otherwise it
 * edits the single draft it was opened on.
 */
export function EditorDrawer({
  drafts,
  openId,
  author,
  canMutate,
  onClose,
  onChanged,
}: {
  drafts: EditorDraft[];
  openId: string | null;
  author: FeedAuthor;
  canMutate: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const open = openId !== null && drafts.some((d) => d.id === openId);
  return (
    <Drawer open={open} onClose={onClose} size="wide" label="Edit post">
      {open ? (
        <EditorBody
          key={openId}
          drafts={drafts}
          initialId={openId}
          author={author}
          canMutate={canMutate}
          onClose={onClose}
          onChanged={onChanged}
        />
      ) : null}
    </Drawer>
  );
}

function EditorBody({
  drafts,
  initialId,
  author,
  canMutate,
  onClose,
  onChanged,
}: {
  drafts: EditorDraft[];
  initialId: string;
  author: FeedAuthor;
  canMutate: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [currentId, setCurrentId] = useState(initialId);
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(drafts.map((d) => [d.id, d.body])),
  );
  const [pending, startTransition] = useTransition();

  const draft = drafts.find((d) => d.id === currentId) ?? drafts[0];
  const platform = draft.platform as PlatformId;
  const name = platformLabel(platform);
  const body = texts[draft.id] ?? draft.body;
  const composed = composePost({ platform, body, hashtags: draft.hashtags });
  const max = PLATFORM_PLAYBOOKS[platform]?.maxChars ?? 0;
  const over = max > 0 && composed.length > max;
  const dirty = body.trim() !== draft.body.trim();
  const locked = !canEditDraft(draft.status);
  const isApproved = draft.status === "approved";
  const destination = nativePublishDestination(platform);
  const instagram = platform === "instagram" ? splitInstagramBody(draft.body) : null;
  const imageExport = instagram?.slides.length
    ? `/api/og/carousel?draftId=${encodeURIComponent(draft.id)}&slide=0`
    : draft.image_url ?? (instagram?.stories.length ? null : `/api/og/quote?draftId=${encodeURIComponent(draft.id)}`);

  function run(label: string, steps: (() => Promise<void>)[], close = true) {
    startTransition(async () => {
      try {
        for (const step of steps) await step();
        toast.success(label);
        await onChanged();
        if (close) onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(composeDraftExport({ platform, body, hashtags: draft.hashtags }));
      toast.success(platform === "instagram" ? "Copied the post and script" : "Copied the post");
    } catch {
      toast.error("Could not copy");
    }
  }

  const saveEdit = () =>
    reviewDraftOrThrow(draft.campaign_id, draft.id, {
      action: "edit",
      body: body.trim(),
      hashtags: draft.hashtags,
    });
  // Approving with the edited copy saves it as a new version in the same step.
  const approve = () =>
    reviewDraftOrThrow(draft.campaign_id, draft.id, dirty
      ? { action: "approve", body: body.trim(), hashtags: draft.hashtags }
      : { action: "approve" });

  return (
    <>
      <div className="l-drawer-head" style={{ alignItems: "center" }}>
        <h2 className="l-drawer-title">Edit {name}</h2>
        <button type="button" className="l-icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      {drafts.length > 1 ? (
        <div role="tablist" aria-label="Post" className="l-tabs l-tabs-deep" style={{ alignSelf: "flex-start" }}>
          {drafts.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              className="l-tab"
              aria-selected={d.id === draft.id}
              onClick={() => setCurrentId(d.id)}
            >
              {platformLabel(d.platform)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="l-drawer-actions" style={{ marginTop: 0 }}>
        <button type="button" className="l-btn l-btn-quiet l-btn-sm" onClick={() => void copyAll()}>
          {platform === "instagram" ? "Copy post and script" : "Copy post"}
        </button>
        {imageExport ? (
          <a className="l-btn l-btn-quiet l-btn-sm" href={imageExport} target="_blank" rel="noreferrer">
            Open image export
          </a>
        ) : null}
      </div>
      {draft.publish_error ? (
        <p role="alert" className="l-alert">
          Publication error: {draft.publish_error}
        </p>
      ) : null}
      {draft.status === "publish_failed" ? (
        <p role="alert" className="l-alert">
          Publication outcome is uncertain. An admin must reconcile it before any retry.{" "}
          <a href={`/campaigns/${draft.campaign_id}`} className="l-link">
            Open the run
          </a>
        </p>
      ) : null}
      {!destination ? (
        <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
          Export only: copy the post and download the image, then post it yourself.
        </p>
      ) : null}

      <div className="l-preview">
        <div className="l-preview-author">
          <span aria-hidden="true" className="l-preview-avatar">
            {author.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="l-preview-who">
            <span className="l-preview-name">{platform === "x" || platform === "threads" ? `@${author.handle}` : author.name}</span>
            <span className="l-preview-meta">{name} · preview</span>
          </span>
        </div>
        {draft.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.image_url} alt="" className="l-preview-img" />
        ) : null}
        <p className="l-preview-text">{composed}</p>
      </div>

      {platform === "instagram" ? (
        <DraftCreative draftId={draft.id} body={draft.body} platform={platform} imageUrl={draft.image_url} />
      ) : null}

      <div className="l-field">
        <div className="l-field-row">
          <label htmlFor="edtext" className="l-label">
            Post text
          </label>
          <span className={`l-count${over ? " is-over" : ""}`}>
            {max ? `${composed.length.toLocaleString()} / ${max.toLocaleString()}` : `${composed.length} characters`}
          </span>
        </div>
        <textarea
          id="edtext"
          rows={9}
          className="l-input l-input-deep"
          value={body}
          disabled={!canMutate || pending || locked}
          readOnly={!canMutate || locked}
          onChange={(e) => setTexts((t) => ({ ...t, [draft.id]: e.target.value }))}
        />
        {draft.hashtags.length ? (
          <span className="l-faint" style={{ fontSize: 13 }}>
            Hashtags are added on publish: {draft.hashtags.map((t) => `#${t.replace(/^#+/, "")}`).join(" ")}
          </span>
        ) : null}
      </div>

      <section aria-label="Critic score" className="l-score">
        <div className="l-score-head">
          <span style={{ fontWeight: 600 }}>Critic score</span>
          <span className="mono" style={{ fontSize: 15 }}>
            <span className="l-lime">{draft.score != null ? draft.score.toFixed(2) : "—"}</span> · passes at 0.80
          </span>
        </div>
        {draft.scores ? (
          CRITERIA.map((c) => {
            const val = draft.scores?.[c.key] ?? 0;
            return (
              <div key={c.key} className="l-score-row">
                <span className="l-score-label">{c.label}</span>
                <span aria-hidden="true" className="l-score-track">
                  <span className="l-score-fill" style={{ width: `${Math.round(val * 100)}%` }} />
                  <span className="l-score-mark" />
                </span>
                <span className="mono" style={{ textAlign: "right" }}>
                  {val.toFixed(2)}
                </span>
              </div>
            );
          })
        ) : (
          <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
            Not scored yet
          </p>
        )}
        {dirty ? (
          <p className="l-faint" style={{ margin: 0, fontSize: 13 }}>
            Scores are for the critic’s version; your edits aren’t re-scored.
          </p>
        ) : null}
      </section>

      {canMutate && !locked ? (
        <div className="l-drawer-actions">
          <button
            type="button"
            className="l-btn l-btn-light"
            disabled={pending || !body.trim() || (!dirty && !canApproveDraft(draft.status))}
            onClick={() => run(dirty ? "Saved and approved" : "Approved", [approve])}
          >
            {dirty ? "Save and approve" : isApproved ? "Approved" : "Approve"}
          </button>
          <button
            type="button"
            className="l-btn l-btn-quiet"
            disabled={pending || !dirty || !body.trim()}
            onClick={() => run("Saved as draft", [saveEdit])}
          >
            Keep as draft
          </button>
          <button type="button" className="l-btn l-btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      ) : (
        <p className="l-faint" style={{ margin: 0 }}>
          {draft.status === "published"
            ? "This post is live, so it can’t be edited here."
            : locked
              ? "This post is being published or waiting on an admin, so it’s locked."
              : "You can read this post; an editor can change it."}
        </p>
      )}
    </>
  );
}
