"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { localToIso, reviewDraftOrThrow, reviseDraftOrThrow } from "@/lib/review-draft";
import { isWaiting, platformLabel, shortDateTime } from "@/lib/workspace-ui";
import type { DraftStatus, PublishDestinations } from "@/shared/types";

export type ActionDraft = {
  id: string;
  campaign_id: string;
  platform: string;
  status: DraftStatus;
  scheduled_at: string | null;
  published_url: string | null;
};

export type PublishAccess = {
  /** Role may publish/schedule, and the app isn't a public demo. */
  allowed: boolean;
  /** Why not, when it isn't allowed. */
  reason?: string;
  destinations: PublishDestinations;
};

/** Where a platform's approved posts go live. */
export function destinationFor(platform: string): "LinkedIn" | "Bluesky" {
  return platform === "linkedin" ? "LinkedIn" : "Bluesky";
}

function destinationReady(platform: string, d: PublishDestinations): boolean {
  return platform === "linkedin" ? d.linkedin : d.bluesky;
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
 * Every human decision on one post: approve, schedule, publish now, or
 * ask the writer for changes. Shown in the Track drawer and on the run
 * page; it only ever calls the review and revise APIs.
 */
export function PostActions({
  draft,
  canMutate,
  publish,
  onChanged,
}: {
  draft: ActionDraft;
  canMutate: boolean;
  publish: PublishAccess;
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "schedule" | "changes">("idle");
  const [when, setWhen] = useState(tomorrowNine);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [busyLabel, setBusyLabel] = useState("");

  if (!canMutate) {
    return <p className="l-faint" style={{ margin: 0 }}>An editor can approve and schedule this post.</p>;
  }

  const waiting = isWaiting(draft);
  const approved = draft.status === "approved";
  const dest = destinationFor(draft.platform);
  const destReady = destinationReady(draft.platform, publish.destinations);

  function run(label: string, busy: string, steps: (() => Promise<void>)[]) {
    setBusyLabel(busy);
    startTransition(async () => {
      try {
        for (const step of steps) await step();
        toast.success(label);
        setMode("idle");
        setNote("");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusyLabel("");
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

  if (draft.status === "published") {
    return draft.published_url ? (
      <a href={draft.published_url} target="_blank" rel="noreferrer" className="l-btn l-btn-outline" style={{ alignSelf: "flex-start" }}>
        View the live post
      </a>
    ) : (
      <p className="l-faint" style={{ margin: 0 }}>Published.</p>
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
        {pending ? <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>The writer and critic take about half a minute.</p> : null}
      </div>
    );
  }

  if (mode === "schedule") {
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
        {!destReady ? (
          <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
            {dest} isn’t connected yet. It will publish once you{" "}
            <Link href="/integrations" className="l-link-lime">
              connect it
            </Link>
            .
          </p>
        ) : null}
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

  return (
    <div className="l-stack-12">
      {approved && draft.scheduled_at ? (
        <p style={{ margin: 0, fontSize: 15 }}>
          Goes live on {dest} <span className="l-lime">{shortDateTime(draft.scheduled_at)}</span>
        </p>
      ) : null}
      <div className="l-drawer-actions">
        {waiting || draft.status === "rejected" ? (
          <>
            <button type="button" className="l-btn l-btn-lime" disabled={pending} onClick={() => run(`${platformLabel(draft.platform)} post approved`, "Approving…", [approve])}>
              {pending ? busyLabel : "Approve"}
            </button>
            {publish.allowed ? (
              <button type="button" className="l-btn l-btn-outline" disabled={pending} onClick={() => setMode("schedule")}>
                Approve and schedule
              </button>
            ) : null}
            <button type="button" className="l-btn l-btn-quiet" disabled={pending} onClick={() => setMode("changes")}>
              Ask for changes
            </button>
          </>
        ) : null}
        {approved ? (
          <>
            {publish.allowed && destReady ? (
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
            {publish.allowed && !destReady ? (
              <Link href="/integrations" className="l-btn l-btn-outline">
                Connect {dest} to publish
              </Link>
            ) : null}
            {publish.allowed ? (
              <button type="button" className="l-btn l-btn-outline" disabled={pending} onClick={() => setMode("schedule")}>
                {draft.scheduled_at ? "Change time" : "Schedule"}
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
            <button type="button" className="l-btn l-btn-quiet" disabled={pending} onClick={() => setMode("changes")}>
              Ask for changes
            </button>
          </>
        ) : null}
      </div>
      {!publish.allowed && publish.reason ? (
        <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
          {publish.reason}
        </p>
      ) : null}
    </div>
  );
}
