"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/leno/drawer";
import { FeedPreview, QualityScorecard, type FeedAuthor } from "@/components/leno/feed-preview";
import { PLATFORM_PLAYBOOKS } from "@/agents/platforms";
import { localToIso, reviewDraftOrThrow } from "@/lib/review-draft";
import { platformLabel } from "@/lib/workspace-ui";
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
};

export function EditorDrawer({
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
  onChanged: () => void;
}) {
  const [body, setBody] = useState(draft?.body ?? "");
  const [preview, setPreview] = useState(draft?.platform ?? "linkedin");
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setBody(draft?.body ?? "");
    setPreview(draft?.platform ?? "linkedin");
    setScheduleLocal("");
  }, [draft]);

  const open = Boolean(draft);
  const platform = (draft?.platform ?? "linkedin") as PlatformId;
  const playbook = PLATFORM_PLAYBOOKS[platform];
  const limit = playbook?.maxChars ?? 3000;
  const currentBody = draft ? body : "";

  function run(label: string, fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        onChanged();
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
                disabled={!canMutate || pending}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            {canMutate ? (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: "auto" }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <input
                  type="datetime-local"
                  className="input-field"
                  style={{ width: 190 }}
                  value={scheduleLocal}
                  onChange={(e) => setScheduleLocal(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={pending || !scheduleLocal}
                  onClick={() => {
                    const iso = localToIso(scheduleLocal);
                    if (!iso) return;
                    run("Scheduled", () =>
                      reviewDraftOrThrow(draft.campaign_id, draft.id, {
                        action: "schedule",
                        scheduled_at: iso,
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
                    disabled={pending}
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
                  disabled={pending}
                  onClick={() =>
                    run("Approved", () =>
                      reviewDraftOrThrow(draft.campaign_id, draft.id, {
                        action: "approve",
                      }),
                    )
                  }
                >
                  Approve Post
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
