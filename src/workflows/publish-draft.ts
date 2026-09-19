import { composePost } from "@/agents/platforms";
import { readFittedImage } from "@/creative/storage";
import {
  getDraft,
  markDraftPublished,
  type DraftRow,
} from "@/db/queries/drafts";
import { AppError } from "@/shared/errors";
import type { PlatformId } from "@/shared/types";
import { blueskyConfigured, publish as publishToBluesky } from "@/tools/social/bluesky";
import {
  linkedinConnected,
  publish as publishToLinkedIn,
} from "@/tools/social/linkedin";

/**
 * Publishes an approved draft to its live channel. LinkedIn drafts go
 * to LinkedIn; every other platform still ships through Bluesky.
 * Agents never call this — only the draft review API after a human.
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

  const platform = existing.platform as PlatformId;
  const text = composePost({
    platform,
    body: existing.body,
    hashtags: existing.hashtags ?? [],
  });

  const fitted = await readFittedImage(
    existing.workspace_id,
    existing.campaign_id,
    platform,
  );
  const image = fitted
    ? { bytes: fitted, mime: "image/jpeg", alt: existing.body.slice(0, 200) }
    : undefined;

  const result =
    platform === "linkedin"
      ? await publishToLinkedIn(existing.workspace_id, text, image)
      : await publishToBluesky(text, image);

  const draft = await markDraftPublished(draftId, result.url);
  if (!draft) {
    throw new Error("Failed to mark draft as published");
  }
  return { draft, url: result.url };
}

export async function assertPublishReady(
  workspaceId: string,
  platform: PlatformId,
): Promise<void> {
  if (platform === "linkedin") {
    if (!(await linkedinConnected(workspaceId))) {
      throw new AppError(
        "not_configured",
        "Connect LinkedIn on Integrations before publishing this draft.",
      );
    }
    return;
  }
  if (!blueskyConfigured()) {
    throw new AppError(
      "not_configured",
      "Bluesky is not configured — add credentials in the server environment.",
    );
  }
}
