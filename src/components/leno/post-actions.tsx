"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { localToIso, reviewDraftOrThrow, reviseDraftOrThrow } from "@/lib/review-draft";
import {
  canApproveDraft,
  nativePublishDestination,
  platformLabel,
  shortDateTime,
} from "@/lib/workspace-ui";
import type { DraftStatus, PublishDestinations } from "@/shared/types";

export type ActionDraft = {
  id: string;
  campaign_id: string;
  platform: string;
  status: DraftStatus;
  scheduled_at: string | null;
  published_url: string | null;
  publish_error?: string | null;
  revision_token?: string | null;
};

export type PublishAccess = {
  /** Role may publish/schedule, and the app isn't a public demo. */
  allowed: boolean;
  /** Why not, when it isn't allowed. */
  reason?: string;
  destinations: PublishDestinations;
};

/** Where a platform's approved posts go live; null means export-only. */
export function destinationFor(platform: string): "LinkedIn" | "Bluesky" | null {
  return nativePublishDestination(platform);
}

function destinationReady(platform: string, d: PublishDestinations): boolean {
  if (platform === "linkedin") return d.linkedin;
  if (platform === "x") return d.bluesky;
  return false;
}

/** Default schedule time: tomorrow 09:00 local, as a datetime-local value. */
function tomorrowNine(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Every human decision on one post: approve, schedule, publish now, ask the
 * writer for changes, and (admins) settle a publish whose outcome is
 * uncertain. It only calls the review and revise APIs; nothing here
 * publishes without a person pressing the button.
 */
export function PostActions({
  draft,
  canMutate,
  isAdmin = false,
  publish,
  onChanged,
}: {
  draft: ActionDraft;
  canMutate: boolean;
  isAdmin?: boolean;
  publish: PublishAccess;
  onChanged: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"idle" | "schedule" | "changes">("idle");
  const [when, setWhen] = useState(tomorrowNine);
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState(false);
  const [liveUrl, setLiveUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyLabel, setBusyLabel] = useState("");

  const dest = destinationFor(draft.platform);
  const destReady = destinationReady(draft.platform, publish.destinations);
  const waiting = canApproveDraft(draft.status);
  const approved = draft.status === "approved";

  function run(label: string, busy: string, steps: (() => Promise<void>)[]) {
    setBusyLabel(busy);
    startTransition(async () => {
      try {
        for (const step of steps) await step();
        toast.success(label);
        setMode("idle");
        setNote("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusyLabel("");
        try {
          await onChanged();
        } catch {
          toast.error("Could not refresh. Reload before another action.");
        }
      }
    });
  }

  const approve = () => reviewDraftOrThrow(draft.campaign_id, draft.id, { action: "approve" });
  const schedule = () => {
    const iso = localToIso(when);
    if (!iso || new Date(iso).getTime() <= Date.now()) {
      return Promise.reject(new Error("Pick a time in the future"));
    }
    return reviewDraftOrThrow(draft.campaign_id, draft.id, { action: "schedule", scheduled_at: iso });
  };

  const errorLine = draft.publish_error ? (
    <p role="alert" className="l-alert">
      Publication error: {draft.publish_error}
    </p>
  ) : null;

  if (draft.status === "published") {
    return draft.published_url ? (
      <a href={draft.published_url} target="_blank" rel="noreferrer" className="l-btn l-btn-outline" style={{ alignSelf: "flex-start" }}>
        View the live post
      </a>
    ) : (
      <p className="l-faint" style={{ margin: 0 }}>
        Published.
      </p>
    );
  }

  if (draft.status === "publishing") {
    return (
      <p className="l-faint l-pulse" style={{ margin: 0 }}>
        Publishing to {dest ?? "the destination"}…
      </p>
    );
  }

  if (draft.status === "publish_failed") {
    return (
      <div className="l-stack-12">
        {errorLine}
        <p role="alert" style={{ margin: 0 }}>
          Publication outcome is uncertain. Do not retry until an admin checks {dest ?? "the destination"}.
        </p>
        {isAdmin && canMutate ? (
          <>
            <label className="l-check">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              I checked the destination and confirmed the outcome.
            </label>
            <input
              className="l-input l-input-deep"
              type="url"
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              placeholder="Published post URL (optional)"
              aria-label="Published post URL"
            />
            <div className="l-drawer-actions">
              <button
                type="button"
                className="l-btn l-btn-lime"
                disabled={pending || !checked}
                onClick={() =>
                  run("Marked as published", "Saving…", [
                    () =>
                      reviewDraftOrThrow(draft.campaign_id, draft.id, {
                        action: "resolve_publication",
                        outcome: "published",
                        ...(liveUrl.trim() ? { published_url: liveUrl.trim() } : {}),
                      }),
                  ])
                }
              >
                Confirm published
              </button>
              <button
                type="button"
                className="l-btn l-btn-outline"
                disabled={pending || !checked}
                onClick={() =>
                  run("Marked as not published", "Saving…", [
                    () => reviewDraftOrThrow(draft.campaign_id, draft.id, { action: "resolve_publication", outcome: "not_published" }),
                  ])
                }
              >
                Confirm not published
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  if (!canMutate) {
    return (
      <p className="l-faint" style={{ margin: 0 }}>
        An editor can approve and schedule this post.
      </p>
    );
  }

  if (draft.revision_token) {
    return (
      <p className="l-faint l-pulse" style={{ margin: 0 }}>
        The writer is revising this post…
      </p>
    );
  }

  if (mode === "changes") {
    return (
      <div className="l-field">
        <label htmlFor={`note-${draft.id}`} className="l-label">
          What should the writer change?
        </label>
        <textarea
          id={`note-${draft.id}`}
          rows={4}
          className="l-input l-input-deep"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Lead with the 90% stat and cut the last paragraph"
          disabled={pending}
        />
        <div className="l-drawer-actions" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="l-btn l-btn-lime"
            disabled={pending || note.trim().length < 5}
            onClick={() =>
              run("Rewritten. The new version is waiting for you", "Rewriting…", [
                () => reviseDraftOrThrow(draft.id, note.trim()),
              ])
            }
          >
            {pending ? busyLabel : "Rewrite it"}
          </button>
          <button type="button" className="l-btn l-btn-quiet" disabled={pending} onClick={() => setMode("idle")}>
            Cancel
          </button>
        </div>
        <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
          The writer works from the saved copy; save any edits first. It takes about half a minute.
        </p>
      </div>
    );
  }

  if (mode === "schedule" && dest) {
    return (
      <div className="l-field">
        <label htmlFor={`when-${draft.id}`} className="l-label">
          Publish to {dest} at
        </label>
        <input
          id={`when-${draft.id}`}
          type="datetime-local"
          className="l-input l-input-deep"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          disabled={pending}
        />
        <div className="l-drawer-actions" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="l-btn l-btn-lime"
            disabled={pending || !when}
            onClick={() =>
              run(`Scheduled for ${shortDateTime(localToIso(when) ?? when)}`, "Scheduling…", waiting ? [approve, schedule] : [schedule])
            }
          >
            {pending ? busyLabel : waiting ? "Approve and schedule" : "Save time"}
          </button>
          <button type="button" className="l-btn l-btn-quiet" disabled={pending} onClick={() => setMode("idle")}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const canSchedule = Boolean(dest) && publish.allowed && destReady;
  const canRevise = !draft.scheduled_at;

  return (
    <div className="l-stack-12">
      {errorLine}
      {approved && draft.scheduled_at && dest ? (
        <p style={{ margin: 0, fontSize: 15 }}>
          Goes live on {dest} <span className="l-lime">{shortDateTime(draft.scheduled_at)}</span>
        </p>
      ) : null}
      <div className="l-drawer-actions">
        {waiting ? (
          <>
            <button
              type="button"
              className="l-btn l-btn-lime"
              disabled={pending}
              onClick={() => run(`${platformLabel(draft.platform)} post approved`, "Approving…", [approve])}
            >
              {pending ? busyLabel : "Approve"}
            </button>
            {canSchedule ? (
              <button type="button" className="l-btn l-btn-outline" disabled={pending} onClick={() => setMode("schedule")}>
                Approve and schedule
              </button>
            ) : null}
          </>
        ) : null}
        {approved ? (
          <>
            {dest && publish.allowed && destReady ? (
              <button
                type="button"
                className="l-btn l-btn-lime"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Publish this post to ${dest} now?`)) return;
                  run(`Published to ${dest}`, "Publishing…", [
                    () => reviewDraftOrThrow(draft.campaign_id, draft.id, { action: "publish" }),
                  ]);
                }}
              >
                {pending ? busyLabel : `Publish to ${dest} now`}
              </button>
            ) : null}
            {dest && publish.allowed && !destReady ? (
              <Link href="/integrations" className="l-btn l-btn-outline">
                Connect {dest} to publish
              </Link>
            ) : null}
            {canSchedule ? (
              <button type="button" className="l-btn l-btn-outline" disabled={pending} onClick={() => setMode("schedule")}>
                {draft.scheduled_at ? "Change time" : "Schedule"}
              </button>
            ) : !dest ? (
              <button type="button" className="l-btn l-btn-outline" disabled title="This platform is export-only">
                Schedule
              </button>
            ) : null}
            {publish.allowed && draft.scheduled_at ? (
              <button
                type="button"
                className="l-btn l-btn-quiet"
                disabled={pending}
                onClick={() =>
                  run("Taken off the schedule", "Clearing…", [
                    () => reviewDraftOrThrow(draft.campaign_id, draft.id, { action: "clear_schedule" }),
                  ])
                }
              >
                Clear schedule
              </button>
            ) : null}
          </>
        ) : null}
        {canRevise && (waiting || approved) ? (
          <button type="button" className="l-btn l-btn-quiet" disabled={pending} onClick={() => setMode("changes")}>
            Ask for changes
          </button>
        ) : null}
      </div>
      {!dest ? (
        <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
          Export only: copy the post and download its image, then post it yourself. {platformLabel(draft.platform)} has no
          native publishing or scheduling.
        </p>
      ) : !publish.allowed && publish.reason ? (
        <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
          {publish.reason}
        </p>
      ) : null}
      {draft.scheduled_at && (waiting || approved) ? (
        <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
          To ask for changes, clear the schedule first.
        </p>
      ) : null}
    </div>
  );
}
