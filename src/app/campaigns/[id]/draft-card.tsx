"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { inputClass, textareaClass } from "@/app/brand/field";
import { PLATFORM_PLAYBOOKS, composePost } from "@/agents/platforms";
import { apiErrorMessage } from "@/lib/api-error";
import type { CriticNotes, DraftStatus, PlatformId, PublishDestinations } from "@/shared/types";
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

function statusLabel(status: DraftStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "needs_human":
      return "Needs review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "published":
      return "Published";
    case "superseded":
      return "Replaced";
  }
}

function statusVariant(
  status: DraftStatus,
): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "approved":
    case "published":
      return "success";
    case "rejected":
      return "danger";
    case "needs_human":
      return "warning";
    default:
      return "default";
  }
}

export function DraftCard({
  draft,
  destinations,
  onChanged,
}: {
  draft: DraftCardData;
  destinations?: PublishDestinations;
  onChanged: () => void;
}) {
  const platform = draft.platform as PlatformId;
  const playbook = PLATFORM_PLAYBOOKS[platform];
  const composed = composePost({
    platform,
    body: draft.body,
    hashtags: draft.hashtags ?? [],
  });
  const limit = playbook?.maxChars ?? 0;

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [hashtagsText, setHashtagsText] = useState(
    (draft.hashtags ?? []).join(" "),
  );
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [pending, startTransition] = useTransition();

  function parseHashtags(raw: string): string[] {
    return raw
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function localToIso(local: string): string | null {
    if (!local) return null;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function actionToast(payload: unknown): string {
    if (!payload || typeof payload !== "object" || !("action" in payload)) {
      return "Saved";
    }
    switch (payload.action) {
      case "approve":
        return "Approved";
      case "reject":
        return "Rejected";
      case "edit":
        return "Saved edit";
      case "publish":
        return platform === "linkedin"
          ? "Published to LinkedIn"
          : "Published to Bluesky";
      case "schedule":
        return "Scheduled";
      case "clear_schedule":
        return "Schedule cleared";
      default:
        return "Saved";
    }
  }

  function review(payload: unknown) {
    startTransition(async () => {
      const res = await fetch(
        `/api/campaigns/${draft.campaign_id}/drafts/${draft.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = apiErrorMessage(data, `Request failed (${res.status})`);
        toast.error(message);
        return;
      }
      toast.success(actionToast(payload));
      setEditing(false);
      setRejecting(false);
      setRejectNote("");
      setScheduling(false);
      setScheduleLocal("");
      onChanged();
    });
  }

  async function copyPost() {
    try {
      await navigator.clipboard.writeText(composed);
      toast.success("Copied post");
    } catch {
      toast.error("Could not copy");
    }
  }

  const locked = draft.status === "published" || draft.status === "approved";
  const notes = draft.critic_notes;
  const destination = platform === "linkedin" ? "LinkedIn" : "Bluesky";
  const canPublish =
    platform === "linkedin"
      ? Boolean(destinations?.linkedin)
      : Boolean(destinations?.bluesky);

  return (
    <article className="card">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {playbook?.displayName ?? draft.platform}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              v{draft.version} · {composed.length}/{limit} chars
            </span>
            <Badge variant={statusVariant(draft.status)}>
              {statusLabel(draft.status)}
            </Badge>
            {draft.score !== null ? (
              <span className="tabular-nums">score {draft.score.toFixed(2)}</span>
            ) : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={copyPost}>
          Copy
        </Button>
      </header>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            className={`${textareaClass} min-h-28`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={pending}
          />
          <input
            className={inputClass}
            value={hashtagsText}
            onChange={(e) => setHashtagsText(e.target.value)}
            placeholder="Hashtags (space-separated)"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                review({
                  action: "edit",
                  body,
                  hashtags: parseHashtags(hashtagsText),
                })
              }
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setBody(draft.body);
                setHashtagsText((draft.hashtags ?? []).join(" "));
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed">
            {composed}
          </pre>
          <DraftCreative
            draftId={draft.id}
            body={draft.body}
            platform={platform}
            imageUrl={draft.image_url}
          />
        </>
      )}

      {notes ? (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
          {notes.rationale ? (
            <p className="text-muted-foreground">{notes.rationale}</p>
          ) : null}
          {notes.gate_failures?.length ? (
            <ul className="list-disc space-y-0.5 pl-4 text-warning-foreground">
              {notes.gate_failures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
          {notes.fix_list?.length ? (
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {notes.fix_list.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {draft.review_note ? (
        <p className="mt-2 text-xs text-warning-foreground">
          Reject note: {draft.review_note}
        </p>
      ) : null}

      {draft.scheduled_at && draft.status === "approved" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Scheduled for {new Date(draft.scheduled_at).toLocaleString()}
        </p>
      ) : null}

      {draft.status === "published" && draft.published_url ? (
        <p className="mt-2 text-xs">
          <a
            href={draft.published_url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            View on {destination}
          </a>
        </p>
      ) : null}

      {rejecting ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            className={`${textareaClass} min-h-20`}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="What should the next revision fix?"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={pending || rejectNote.trim().length === 0}
              onClick={() =>
                review({ action: "reject", review_note: rejectNote.trim() })
              }
            >
              Confirm reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setRejecting(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {scheduling ? (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="datetime-local"
            className={inputClass}
            value={scheduleLocal}
            onChange={(e) => setScheduleLocal(e.target.value)}
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || !scheduleLocal}
              onClick={() => {
                const iso = localToIso(scheduleLocal);
                if (!iso) {
                  toast.error("Pick a valid date and time");
                  return;
                }
                review({ action: "schedule", scheduled_at: iso });
              }}
            >
              Save schedule
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => setScheduling(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {!locked && !editing && !rejecting ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => review({ action: "approve" })}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => setRejecting(true)}
          >
            Reject
          </Button>
        </div>
      ) : null}

      {draft.status === "approved" && !editing && !rejecting && !scheduling ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {canPublish ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => review({ action: "publish" })}
            >
              Publish to {destination}
            </Button>
          ) : (
            <a href="/integrations" className={buttonVariants({ size: "sm", variant: "outline" })}>
              Connect {destination} to publish
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => setScheduling(true)}
          >
            Schedule
          </Button>
          {draft.scheduled_at ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => review({ action: "clear_schedule" })}
            >
              Clear schedule
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
