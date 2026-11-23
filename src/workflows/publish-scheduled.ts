import {
  claimScheduledDraft,
  listDueScheduledDrafts,
  restoreDraftSchedule,
} from "@/db/queries/drafts";
import type { PlatformId } from "@/shared/types";
import { assertPublishReady, publishApprovedDraft } from "@/workflows/publish-draft";

/**
 * Publishes approved drafts whose scheduled time has arrived. Plain,
 * deterministic code: it only ever touches drafts a person already
 * approved and scheduled, and goes through the same publish path as the
 * Publish button. A draft whose channel isn't connected stays scheduled
 * and is retried on the next tick.
 */
export async function publishDueDrafts(now = new Date()): Promise<{
  published: number;
  skipped: number;
  failed: number;
}> {
  const due = await listDueScheduledDrafts(now);
  let published = 0;
  let skipped = 0;
  let failed = 0;

  for (const draft of due) {
    const when = draft.scheduled_at;
    if (!when) continue;
    try {
      await assertPublishReady(draft.workspace_id, draft.platform as PlatformId);
    } catch {
      skipped += 1;
      continue;
    }
    if (!(await claimScheduledDraft(draft.id, when))) continue;
    try {
      await publishApprovedDraft(draft.id);
      published += 1;
    } catch (err) {
      failed += 1;
      await restoreDraftSchedule(draft.id, when);
      console.error(`[scheduler] publishing draft ${draft.id} failed:`, err);
    }
  }
  return { published, skipped, failed };
}

const TICK_MS = 60_000;
const globalForScheduler = globalThis as unknown as { __lenoScheduler?: NodeJS.Timeout };

/** Starts the once-a-minute check. Safe to call more than once. */
export function startScheduledPublisher(): void {
  if (globalForScheduler.__lenoScheduler) return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const result = await publishDueDrafts();
      if (result.published || result.failed) {
        console.log("[scheduler]", result);
      }
    } catch (err) {
      console.error("[scheduler] tick failed:", err);
    } finally {
      busy = false;
    }
  };
  globalForScheduler.__lenoScheduler = setInterval(() => void tick(), TICK_MS);
  globalForScheduler.__lenoScheduler.unref?.();
}
