"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PLATFORM_PLAYBOOKS, composePost } from "@/agents/platforms";
import { PostActions, type PublishAccess } from "@/components/leno/post-actions";
import { reviewDraftOrThrow } from "@/lib/review-draft";
import { statusBadgeClass, statusWord } from "@/lib/workspace-ui";
import type { CriticNotes, DraftStatus, PlatformId } from "@/shared/types";
import { DraftCreative } from "./draft-creative";

export type DraftCardData = {
  id: string;
  campaign_id: string;
  platform: string;
  version: number;
  body: string;
  hashtags: string[];
  score: number | null;
  critic_notes: CriticNotes | null;
  status: DraftStatus;
  review_note: string | null;
  scheduled_at: string | null;
  published_url: string | null;
  image_url: string | null;
};

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function DraftCard({
  draft,
  live,
  canMutate,
  publish,
  onChanged,
}: {
  draft: DraftCardData;
  live: boolean;
  canMutate: boolean;
  publish: PublishAccess;
  onChanged: () => void;
}) {
  const platform = draft.platform as PlatformId;
  const playbook = PLATFORM_PLAYBOOKS[platform];
  const composed = composePost({ platform, body: draft.body, hashtags: draft.hashtags ?? [] });
  const limit = playbook?.maxChars ?? 0;

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [tags, setTags] = useState((draft.hashtags ?? []).join(" "));
  const [pending, startTransition] = useTransition();

  const notes = draft.critic_notes;
  const editable = canMutate && draft.status !== "published" && !live;

  async function copy() {
    try {
      await navigator.clipboard.writeText(composed);
      toast.success("Copied the post");
    } catch {
      toast.error("Could not copy");
    }
  }

  function save() {
    startTransition(async () => {
      try {
        await reviewDraftOrThrow(draft.campaign_id, draft.id, {
          action: "edit",
          body: body.trim(),
          hashtags: parseHashtags(tags),
        });
        toast.success("Saved. It needs your approval again");
        setEditing(false);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  const editedLength = composePost({ platform, body, hashtags: parseHashtags(tags) }).length;

  return (
    <article className="l-card l-draft">
      <header className="l-draft-head">
        <div className="l-stack-4">
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>{playbook?.displayName ?? draft.platform}</h3>
          <span className="l-count">
            v{draft.version} · {composed.length.toLocaleString()}/{limit.toLocaleString()}
            {draft.score !== null ? ` · score ${draft.score.toFixed(2)}` : ""}
          </span>
        </div>
        <span className={statusBadgeClass(draft)}>{statusWord(draft)}</span>
      </header>

      {editing ? (
        <div className="l-stack-12">
          <div className="l-field">
            <div className="l-field-row">
              <label htmlFor={`body-${draft.id}`} className="l-label">
                Post text
              </label>
              <span className={`l-count${limit && editedLength > limit ? " is-over" : ""}`}>
                {editedLength}/{limit}
              </span>
            </div>
            <textarea
              id={`body-${draft.id}`}
              rows={8}
              className="l-input l-input-deep"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="l-field">
            <label htmlFor={`tags-${draft.id}`} className="l-label">
              Hashtags
            </label>
            <input
              id={`tags-${draft.id}`}
              className="l-input l-input-deep"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="#launch #audio"
              disabled={pending}
            />
          </div>
          <div className="l-drawer-actions">
            <button type="button" className="l-btn l-btn-light" disabled={pending || !body.trim()} onClick={save}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="l-btn l-btn-quiet"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setBody(draft.body);
                setTags((draft.hashtags ?? []).join(" "));
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="l-post-text">{composed}</p>
          <DraftCreative draftId={draft.id} body={draft.body} platform={platform} imageUrl={draft.image_url} />
        </>
      )}

      {notes && (notes.rationale || notes.gate_failures?.length || notes.fix_list?.length) ? (
        <details className="l-notes">
          <summary>What the critic said</summary>
          {notes.rationale ? <p>{notes.rationale}</p> : null}
          {notes.gate_failures?.length ? (
            <ul className="is-warn">
              {notes.gate_failures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
          {notes.fix_list?.length ? (
            <ul>
              {notes.fix_list.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}

      {draft.review_note ? (
        <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
          Your note: “{draft.review_note}”
        </p>
      ) : null}

      {!editing ? (
        <div className="l-draft-foot">
          <div className="l-draft-tools">
            <button type="button" className="l-btn l-btn-ghost l-btn-sm" onClick={() => void copy()}>
              Copy
            </button>
            {editable ? (
              <button type="button" className="l-btn l-btn-ghost l-btn-sm" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : null}
          </div>
          {live ? (
            <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
              The critic is still working on this one.
            </p>
          ) : (
            <PostActions draft={draft} canMutate={canMutate} publish={publish} onChanged={onChanged} />
          )}
        </div>
      ) : null}
    </article>
  );
}
