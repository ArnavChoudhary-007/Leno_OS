export type CampaignImagePromptInput = {
  brandName: string;
  oneLiner: string;
  brief: string;
  keyMessage: string;
  primaryColor: string;
  secondaryColor: string;
  toneWords: string[];
};

/** Prompt for GPT Image 1.5 — no on-image type, crop-safe square. */
export function buildCampaignImagePrompt(input: CampaignImagePromptInput): string {
  const tone = input.toneWords.filter(Boolean).join(", ") || "confident, clean";
  return [
    `Create a single square social-feed photograph for ${input.brandName}.`,
    input.oneLiner,
    `Campaign brief: ${input.brief}`,
    `Key idea (do not render as text in the image): ${input.keyMessage}`,
    `Mood: ${tone}.`,
    `Use ${input.primaryColor} and ${input.secondaryColor} as subtle color accents, not as a solid fill.`,
    "Photorealistic, one clear subject, composition that still works if cropped to 16:9 landscape or 4:5 portrait.",
    "No logos, no watermarks, no captions, no typography, no UI chrome.",
  ].join("\n");
}
