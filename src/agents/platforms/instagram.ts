import type { PlatformPlaybook } from "./types";
import {
  INSTAGRAM_HOOK_MAX_CHARS,
  INSTAGRAM_MAX_CAPTION_CHARS,
  INSTAGRAM_MAX_EMOJI,
  INSTAGRAM_MAX_HASHTAGS,
  INSTAGRAM_MAX_SLIDES,
  INSTAGRAM_MIN_SLIDES,
  INSTAGRAM_SLIDE_MAX_WORDS,
} from "./instagram-rules";

export const instagramPlaybook: PlatformPlaybook = {
  id: "instagram",
  displayName: "Instagram",
  enabled: true,
  maxChars: INSTAGRAM_MAX_CAPTION_CHARS,
  maxHashtags: INSTAGRAM_MAX_HASHTAGS,
  formatNotes: [
    "The caption complements the visual rather than describing it.",
    `Keep the standalone first-line hook under ${INSTAGRAM_HOOK_MAX_CHARS} characters, followed by scannable paragraphs and one clear CTA.`,
    `Carousels: ${INSTAGRAM_MIN_SLIDES}-${INSTAGRAM_MAX_SLIDES} separate 'Slide N:' lines with at most ${INSTAGRAM_SLIDE_MAX_WORDS} words each and a final CTA.`,
    "Stories: separate 'Story N:' lines with an interactive sticker in at least one of every three frames.",
  ].join(" "),
  toneNotes: `Warm, visual, specific, and human. Use at most ${INSTAGRAM_MAX_EMOJI} emoji as punctuation, not decoration.`,
  requiresImage: true,
  imageSpec: { width: 819, height: 1024, ratio: "4:5" },
};
