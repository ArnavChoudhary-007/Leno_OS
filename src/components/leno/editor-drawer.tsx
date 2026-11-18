"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/leno/drawer";
import { DraftRevisionNote } from "@/components/leno/draft-revision-note";
import { FeedPreview, QualityScorecard, type FeedAuthor } from "@/components/leno/feed-preview";
import { PLATFORM_PLAYBOOKS, composePost } from "@/agents/platforms";
import { localToIso, reviewDraftOrThrow } from "@/lib/review-draft";
import { canEditDraft, nativePublishDestination, platformLabel } from "@/lib/workspace-ui";
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
  publish_error: string | null;
};

export function EditorDrawer(props: Parameters<typeof EditorDrawerSession>[0]) {
  return <EditorDrawerSession key={props.draft?.id ?? "closed"} {...props} />;
}

function EditorDrawerSession({
  draft,
  author,
  canMutate,
  onClose,
  onChanged,
}: {
  draft: EditorDraft | null;
  author: FeedAuthor;
  canMutate: boolean;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [body, setBody] = useState(draft?.body ?? "");
  const [preview, setPreview] = useState(draft?.platform ?? "linkedin");
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [pending, startTransition] = useTransition();

  const open = Boolean(draft);
  const platform = (draft?.platform ?? "linkedin") as PlatformId;
  const playbook = PLATFORM_PLAYBOOKS[platform];
  const limit = playbook?.maxChars ?? 3000;
  const editable = canMutate && Boolean(draft && canEditDraft(draft.status));
  const currentBody = draft ? editable ? body : draft.body : "";
  const destination = nativePublishDestination(platform);

  function run(label: string, fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        await onChanged();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <Drawer open={open} onClose={onClose} size="wide">
      {draft ? (
        <div className="editor-drawer-container">
          <div className="editor-drawer-header">
            <div>
              <h3 id="editorDrawerTitle" style={{ fontSize: "1.05rem", fontWeight: 700 }}>
                Review Content
              </h3>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {platformLabel(platform)} · {draft.status}
              </span>
            </div>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <div className="editor-drawer-body">
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={async () => {
                try { await navigator.clipboard.writeText(composePost({ platform, body: currentBody, hashtags: draft.hashtags })); toast.success("Copied post"); }
                catch { toast.error("Could not copy post"); }
              }}>Copy post</button>
              <a className="btn btn-secondary" href={draft.image_url ?? `/api/og/quote?draftId=${encodeURIComponent(draft.id)}`} target="_blank" rel="noreferrer">Open image export</a>
            </div>
            {draft.publish_error ? <p role="alert">Publication error: {draft.publish_error}</p> : null}
            {draft.status === "publish_failed" ? <p role="alert">Publication outcome is uncertain. An admin must reconcile it before any retry. <a href={`/campaigns/${draft.campaign_id}`} className="underline">Open campaign for reconciliation</a></p> : null}
            {!destination ? <p>Export-only platform. Copy and image export are available; native publishing and scheduling are not supported.</p> : null}
            <QualityScorecard scores={draft.scores} />
            <div className="tab-nav" style={{ width: "100%" }}>
              {(["linkedin", "instagram", "x"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`tab-nav-btn editor-preview-tab${preview === id ? " active" : ""}`}
                  onClick={() => setPreview(id)}
                >
                  {id === "x" ? "Twitter/X Preview" : `${platformLabel(id)} Preview`}
                </button>
              ))}
            </div>
            <div className="preview-container-box">
              <FeedPreview
                platform={preview}
                body={currentBody}
                hashtags={draft.hashtags}
                imageUrl={draft.image_url}
                author={author}
              />
            </div>
            <div className="input-group">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label className="input-label" htmlFor="editorCopyInput">
                  Edit copy
                </label>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: currentBody.length > limit ? "var(--status-red)" : "var(--text-muted)",
                  }}
                >
                  {currentBody.length} / {limit} characters
                </span>
              </div>
              <textarea
                id="editorCopyInput"
                className="input-field"
                rows={6}
                value={currentBody}
                disabled={!editable || pending}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            {editable ? (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: "auto" }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <input
                  type="datetime-local"
                  className="input-field"
                  style={{ width: 190 }}
                  value={scheduleLocal}
                  disabled={pending || !destination}
                  aria-label="Schedule date and time"
                  onChange={(e) => setScheduleLocal(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pending || !scheduleLocal || !destination || !body.trim()}
                  title={destination ? `Schedule on ${destination}` : "Export-only: scheduling is unavailable"}
                  onClick={() => {
                    const iso = localToIso(scheduleLocal);
                    if (!iso || new Date(iso).getTime() <= Date.now()) {
                      toast.error("Choose a future date and time");
                      return;
                    }
                    run("Scheduled", () =>
                      reviewDraftOrThrow(draft.campaign_id, draft.id, {
                        action: "schedule",
                        scheduled_at: iso,
                        body,
                        hashtags: draft.hashtags,
                      }),
                    );
                  }}
                >
                  Schedule
                </button>
                {body !== draft.body ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={pending || !body.trim()}
                    onClick={() =>
                      run("Saved", () =>
                        reviewDraftOrThrow(draft.campaign_id, draft.id, {
                          action: "edit",
                          body,
                          hashtags: draft.hashtags,
                        }),
                      )
                    }
                  >
                    Save copy
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={pending || !body.trim()}
                  onClick={() =>
                    run("Approved", () =>
                      reviewDraftOrThrow(draft.campaign_id, draft.id, {
                        action: "approve",
                        body,
                        hashtags: draft.hashtags,
                      }),
                    )
                  }
                >
                  Approve Post
                </button>
              </div>
            ) : null}
            {editable && !pending && !draft.scheduled_at && body === draft.body ? <DraftRevisionNote draftId={draft.id} onChanged={async () => { await onChanged(); onClose(); }} /> : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
