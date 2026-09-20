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
    "Caption complements the image or carousel, it never describes it.",
    `First line is the hook and must stand alone under ${INSTAGRAM_HOOK_MAX_CHARS} characters — the rest is hidden behind "more".`,
    "Then short scannable paragraphs, then one clear CTA. Hashtags at the end.",
    `Carousels: "Slide N:" lines, ${INSTAGRAM_MIN_SLIDES}-${INSTAGRAM_MAX_SLIDES} slides, at most ${INSTAGRAM_SLIDE_MAX_WORDS} words each, CTA on the last.`,
    `Stories: "Story N:" lines with an interactive sticker in at least 1 of every 3.`,
  ].join(" "),
  toneNotes: `Warm, visual, aspirational but grounded. Short sentences, concrete nouns. At most ${INSTAGRAM_MAX_EMOJI} emoji, used as punctuation.`,
  requiresImage: true,
  // 4:5, sized to the GPT Image 1.5 cap (IMAGE_MAX_EDGE). The served
  // carousel size is 1080x1350 — see lib/images/platform-specs.ts.
  imageSpec: { width: 819, height: 1024, ratio: "4:5" },
};
