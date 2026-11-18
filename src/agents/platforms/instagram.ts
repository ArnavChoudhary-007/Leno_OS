import type { PlatformPlaybook } from "./types";

export const instagramPlaybook: PlatformPlaybook = {
  id: "instagram",
  displayName: "Instagram",
  enabled: true,
  maxChars: 2200,
  maxHashtags: 30,
  formatNotes:
    "Caption supports multi-slide carousels (4:5 portrait) or static posts. High-converting hook, value-dense educational cards, and clear CTA with niche hashtags.",
  toneNotes: "Warm, visual, authoritative, and human. High-retention pacing with zero corporate buzzwords.",
  requiresImage: true,
  imageSpec: { width: 819, height: 1024, ratio: "4:5" },
};
