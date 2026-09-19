import { composePost } from "@/agents/platforms";
import {
  getDraft,
  markDraftPublished,
  type DraftRow,
} from "@/db/queries/drafts";
import type { PlatformId } from "@/shared/types";
import { publish as publishToBluesky } from "@/tools/social/bluesky";

/**
 * Publishes an approved draft to Bluesky. Agents never call this —
 * only the draft review API after a human has approved.
 */
export async function publishApprovedDraft(
  draftId: string,
): Promise<{ draft: DraftRow; url: string }> {
  const existing = await getDraft(draftId);
  if (!existing) {
    throw new Error("Draft not found");
  }
  if (existing.status === "published") {
    if (existing.published_url) {
      return { draft: existing, url: existing.published_url };
    }
    throw new Error("Draft is already marked published");
  }
  if (existing.status !== "approved") {
    throw new Error("Only approved drafts can be published");
  }

  const text = composePost({
    platform: existing.platform as PlatformId,
    body: existing.body,
    hashtags: existing.hashtags ?? [],
  });

  const result = await publishToBluesky(text);
  const draft = await markDraftPublished(draftId, result.url);
  if (!draft) {
    throw new Error("Failed to mark draft as published");
  }
  return { draft, url: result.url };
}
