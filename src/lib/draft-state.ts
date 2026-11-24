import { AppError } from "@/shared/errors";
import type { DraftStatus } from "@/shared/types";

export const REVIEWABLE_STATUSES: DraftStatus[] = ["draft", "needs_human", "approved", "rejected"];

export function revisionIsActive(draft: { revision_token: string | null; revision_started_at: string | null }, now = Date.now()): boolean {
  return Boolean(draft.revision_token && draft.revision_started_at && now - new Date(draft.revision_started_at).getTime() < 5 * 60_000);
}

export function assertReviewable(draft: { status: DraftStatus }): void {
  if (!REVIEWABLE_STATUSES.includes(draft.status)) {
    throw new AppError("conflict", "This draft is locked. Published posts and unresolved publication attempts cannot be changed.");
  }
}

export function assertRevisable(draft: { status: DraftStatus; scheduled_at: string | null }): void {
  assertReviewable(draft);
  if (draft.scheduled_at) {
    throw new AppError("conflict", "Clear the schedule before asking for a revision.");
  }
}

export function assertFutureSchedule(value: string, now = Date.now()): void {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= now) {
    throw new AppError("invalid_body", "scheduled_at must be a future time");
  }
}

export function supportsPublishing(platform: string): boolean {
  return platform === "linkedin" || platform === "x";
}
