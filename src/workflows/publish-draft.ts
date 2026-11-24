import { composePost, validateDraft } from "@/agents/platforms";
import { isPublicDemo } from "@/auth/public-demo";
import { readFittedImage } from "@/creative/storage";
import { getDraft, type DraftRow } from "@/db/queries/drafts";
import { claimPublication, completePublication, failPublication } from "@/db/queries/publications";
import { supportsPublishing } from "@/lib/draft-state";
import { AppError } from "@/shared/errors";
import type { PlatformId } from "@/shared/types";
import { blueskyConfigured, publish as publishToBluesky } from "@/tools/social/bluesky";
import { linkedinConnected, publish as publishToLinkedIn } from "@/tools/social/linkedin";

export async function publishApprovedDraft(draftId: string, expectedSchedule?: string): Promise<{ draft: DraftRow; url: string }> {
  const existing = await getDraft(draftId);
  if (!existing) throw new AppError("not_found", "Draft not found");
  if (existing.status === "published" && existing.published_url) return { draft: existing, url: existing.published_url };
  await assertPublishReady(existing.workspace_id, existing.platform as PlatformId);
  const preview = composePost({ platform: existing.platform as PlatformId, body: existing.body, hashtags: existing.hashtags });
  const validation = validateDraft(existing.platform as PlatformId, preview, existing.hashtags);
  if (!validation.valid) throw new AppError("not_publishable", validation.errors.join("; "));
  const fitted = await readFittedImage(existing.workspace_id, existing.campaign_id, existing.platform as PlatformId);
  const claimed = await claimPublication(draftId, expectedSchedule);
  if (!claimed.attempt && claimed.draft.published_url) return { draft: claimed.draft, url: claimed.draft.published_url };
  if (!claimed.attempt) throw new AppError("conflict", "Publication was already claimed.");
  let url: string | undefined;
  try {
    const text = composePost({ platform: claimed.draft.platform as PlatformId, body: claimed.draft.body, hashtags: claimed.draft.hashtags });
    const checked = validateDraft(claimed.draft.platform as PlatformId, text, claimed.draft.hashtags);
    if (!checked.valid) throw new AppError("not_publishable", checked.errors.join("; "));
    const image = fitted ? { bytes: fitted, mime: "image/jpeg", alt: claimed.draft.body.slice(0, 200) } : undefined;
    const result = claimed.draft.platform === "linkedin"
      ? await publishToLinkedIn(claimed.draft.workspace_id, text, image)
      : await publishToBluesky(text, image);
    url = result.url;
    const draft = await completePublication(draftId, claimed.attempt.id, url);
    return { draft, url };
  } catch (err) {
    await failPublication(draftId, claimed.attempt.id, url).catch((failure) => console.error("[publish] Could not persist uncertain outcome:", failure));
    console.error("[publish] Publication requires reconciliation:", err);
    throw new AppError("job_failed", "Publication outcome needs review. Check the connected account before retrying.");
  }
}

export async function assertPublishReady(workspaceId: string, platform: PlatformId): Promise<void> {
  if (isPublicDemo()) throw new AppError("forbidden", "Publishing is turned off in this public demo.");
  if (!supportsPublishing(platform)) throw new AppError("not_publishable", "This channel is export-only. Copy the post and download its image to publish natively.");
  if (platform === "linkedin") {
    if (!(await linkedinConnected(workspaceId))) throw new AppError("not_configured", "Connect LinkedIn on Integrations before publishing.");
  } else if (!blueskyConfigured()) {
    throw new AppError("not_configured", "Bluesky is not configured. Add credentials in the server environment.");
  }
}
