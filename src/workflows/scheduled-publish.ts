import { isPublicDemo } from "@/auth/public-demo";
import { listDueDrafts } from "@/db/queries/drafts";
import { deferScheduledDraft, recoverAbandonedPublications } from "@/db/queries/publications";
import { AppError } from "@/shared/errors";
import { publishApprovedDraft } from "./publish-draft";

export async function publishDueDrafts(signal?: AbortSignal): Promise<void> {
  if (isPublicDemo() || signal?.aborted) return;
  await recoverAbandonedPublications();
  for (const draft of await listDueDrafts()) {
    if (signal?.aborted) break;
    if (!draft.scheduled_at) continue;
    try {
      await publishApprovedDraft(draft.id, draft.scheduled_at);
    } catch (err) {
      if (err instanceof AppError && err.code === "conflict") continue;
      if (err instanceof AppError && (err.code === "not_configured" || err.code === "not_publishable")) {
        await deferScheduledDraft(draft.id, draft.scheduled_at, err.message);
      }
      console.error("[scheduler] Could not publish draft " + draft.id + ":", err);
    }
  }
}
