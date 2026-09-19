import { PLATFORM_PLAYBOOKS } from "@/agents/platforms";
import { fitImageToSpec } from "@/creative/fit-image";
import {
  buildCampaignImagePrompt,
  type CampaignImagePromptInput,
} from "@/creative/image-prompt";
import {
  fittedImageUrl,
  readFittedImage,
  readOriginalImage,
  saveFittedImage,
  saveOriginalImage,
} from "@/creative/storage";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { AppError } from "@/shared/errors";
import type { PlatformId } from "@/shared/types";
import {
  generateOpenAIImage,
  isImageGenerationConfigured,
} from "@/tools/openai-image";

export type FitCampaignImagesResult = {
  urls: Partial<Record<PlatformId, string>>;
  generation?: { model: string; size: "1024x1024"; ms: number };
};

/**
 * Cover-crops the campaign photo to each platform's feed size (≤1024×1024).
 * If the user did not attach a photo, generates one 1024×1024 image with
 * GPT Image 1.5, then crops. Deterministic after the image exists — not an agent.
 */
export async function fitCampaignImages(
  workspaceId: string,
  campaignId: string,
  platforms: PlatformId[],
  generate?: CampaignImagePromptInput,
): Promise<FitCampaignImagesResult> {
  let original = await readOriginalImage(workspaceId, campaignId);
  let generation: FitCampaignImagesResult["generation"];

  if (!original && generate && isImageGenerationConfigured()) {
    try {
      await consumeRateLimit(RATE_LIMITS.imageGenerate(workspaceId));
      const generated = await generateOpenAIImage(
        buildCampaignImagePrompt(generate),
      );
      await saveOriginalImage(workspaceId, campaignId, generated.bytes);
      original = generated.bytes;
      generation = {
        model: generated.model,
        size: generated.size,
        ms: generated.ms,
      };
    } catch (err) {
      if (err instanceof AppError && err.code === "rate_limited") {
        console.warn(
          `[creative] image generation rate-limited for workspace ${workspaceId}`,
        );
      } else {
        console.warn(
          `[creative] image generation skipped:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  if (!original) return { urls: {}, generation };

  const urls: Partial<Record<PlatformId, string>> = {};

  for (const platform of platforms) {
    const spec = PLATFORM_PLAYBOOKS[platform]?.imageSpec;
    if (!spec) continue;

    const existing = await readFittedImage(workspaceId, campaignId, platform);
    if (!existing) {
      const fitted = await fitImageToSpec(original, spec);
      await saveFittedImage(workspaceId, campaignId, platform, fitted);
    }
    urls[platform] = fittedImageUrl(campaignId, platform);
  }

  return { urls, generation };
}
