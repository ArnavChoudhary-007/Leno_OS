import type { PlatformPlaybook } from "./types";

export const instagramPlaybook: PlatformPlaybook = {
  id: "instagram",
  displayName: "Instagram",
  enabled: true,
  maxChars: 2200,
  maxHashtags: 30,
  formatNotes:
    "Caption supports an image or carousel — write it to complement the visual, not repeat it. Put hashtags at the end.",
  toneNotes: "Warm, visual, aspirational but grounded. Short sentences.",
  requiresImage: true,
  imageSpec: { width: 819, height: 1024, ratio: "4:5" },
};
