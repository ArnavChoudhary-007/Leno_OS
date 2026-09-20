import type { Draft } from "@/shared/types";

/**
 * Instagram specialist knowledge, ported from the instaagent repo's
 * knowledge/instagram_standards.py and agent/polisher.py. Only the domain
 * knowledge came across: no Python, no agent loop, no hardcoded critic.
 *
 * Two numbers were corrected on the way in:
 * - Hashtags cap at 5, not the source's 30 / "10-15 relevant tags".
 * - Carousels are 4:5 (1080x1350), not the source's 1:1 1080x1080, so they
 *   match PLATFORM_IMAGE_SPECS.instagram in lib/images/platform-specs.ts.
 */

export const INSTAGRAM_MAX_HASHTAGS = 5;
export const INSTAGRAM_MAX_CAPTION_CHARS = 2200;

/** Instagram truncates the caption behind "more" at roughly this point. */
export const INSTAGRAM_HOOK_MAX_CHARS = 125;

export const INSTAGRAM_SLIDE_MAX_WORDS = 30;
export const INSTAGRAM_MIN_SLIDES = 5;
export const INSTAGRAM_MAX_SLIDES = 10;

/** Emoji are punctuation here, not decoration. */
export const INSTAGRAM_MAX_EMOJI = 5;

/** Source rule: "interactive stickers on at least 1 in every 3 stories". */
export const INSTAGRAM_STICKER_WINDOW = 3;

/** Carousel slide canvas. Matches PLATFORM_IMAGE_SPECS.instagram. */
export const INSTAGRAM_CAROUSEL_SPEC = {
  width: 1080,
  height: 1350,
  ratio: "4:5",
} as const;

export const INSTAGRAM_HOOK_ARCHETYPES = [
  "Pattern interrupt (contrarian statement)",
  "Bold metric or statistic",
  "Myth vs reality",
  "Step-by-step framework teaser",
  "Before vs after",
  "Direct question or problem statement",
  "Social proof or testimonial",
] as const;

export const INSTAGRAM_CONTENT_PILLARS = [
  "Educational (how-to, frameworks, tips)",
  "Authority (industry insight, point of view)",
  "Social proof (testimonials, case studies, results)",
  "Product (features, demos, offers)",
  "Engagement (polls, questions, trends)",
] as const;

export const INSTAGRAM_CAROUSEL_TEMPLATES = {
  educational_framework: [
    "Slide 1: Hook — bold statement or pattern interrupt",
    "Slide 2: Problem or context",
    "Slide 3: Step or insight 1",
    "Slide 4: Step or insight 2",
    "Slide 5: Step or insight 3",
    "Slide 6: CTA — save, share, DM, link in bio",
  ],
  myth_busting: [
    "Slide 1: Hook — the common myth",
    "Slide 2: Why people believe it",
    "Slide 3: The reality, with data",
    "Slide 4: What to do instead",
    "Slide 5: CTA",
  ],
  listicle: [
    "Slide 1: Hook — the promise, with a number",
    "Slides 2-5: One item per slide",
    "Slide 6: CTA",
  ],
} as const;

export const INSTAGRAM_STORY_TEMPLATES = {
  educational_walkthrough: [
    "Story 1: Hook — text overlay on a branded background",
    "Story 2: Key insight or tip",
    "Story 3: Poll or question sticker",
    "Story 4: CTA with a link sticker",
  ],
  product_spotlight: [
    "Story 1: Teaser or problem",
    "Story 2: Solution",
    "Story 3: Feature highlight",
    "Story 4: Social proof",
    "Story 5: CTA or offer",
  ],
} as const;

/** Interactive elements that satisfy the 1-in-3 story rule. */
export const INSTAGRAM_STICKERS = [
  "poll",
  "question sticker",
  "quiz",
  "link sticker",
  "countdown",
  "emoji slider",
  "sticker",
] as const;

/** Phrases that read as a real call to action on the final slide. */
export const INSTAGRAM_CTA_CUES = [
  "save this",
  "save it",
  "share this",
  "send this",
  "dm us",
  "dm me",
  "comment",
  "link in bio",
  "tap the link",
  "swipe up",
  "follow for",
  "sign up",
  "book a",
  "download",
  "subscribe",
  "get the",
  "start your",
  "try it",
  "learn more",
] as const;

/**
 * Instagram specialist instruction. Fed to the writer and critic when
 * Instagram is in the campaign. Agents still never publish.
 */
export const INSTAGRAM_WRITING_RULES = [
  "You are the Instagram specialist. The caption complements the visual, it does not describe it.",
  `Hook: the first line is everything — Instagram hides the rest behind "more". Keep it under ${INSTAGRAM_HOOK_MAX_CHARS} characters and make it land on its own.`,
  `Hook archetypes: ${INSTAGRAM_HOOK_ARCHETYPES.join("; ")}.`,
  `Content pillars: ${INSTAGRAM_CONTENT_PILLARS.join("; ")}.`,
  "Caption shape: hook, then short scannable paragraphs with line breaks, then one clear CTA.",
  `Hashtags: at most ${INSTAGRAM_MAX_HASHTAGS}, specific and relevant, placed at the end. Never a wall of tags.`,
  `Emoji: at most ${INSTAGRAM_MAX_EMOJI}, used as punctuation and rhythm, never as decoration.`,
  `Carousels: write them as "Slide 1:", "Slide 2:" lines. ${INSTAGRAM_MIN_SLIDES}-${INSTAGRAM_MAX_SLIDES} slides, at most ${INSTAGRAM_SLIDE_MAX_WORDS} words per slide, hook on slide 1, CTA on the last slide.`,
  `Carousel template (educational): ${INSTAGRAM_CAROUSEL_TEMPLATES.educational_framework.join(" | ")}`,
  `Stories: write them as "Story 1:", "Story 2:" lines. Use an interactive sticker (poll, question, quiz, link, countdown, emoji slider) in at least 1 of every ${INSTAGRAM_STICKER_WINDOW} stories.`,
  `Story template: ${INSTAGRAM_STORY_TEMPLATES.educational_walkthrough.join(" | ")}`,
  "Specificity beats vibe: name the number, the product, the constraint. If it is not in the brief or brand card, leave it out.",
  "Final test: would this stop a thumb, and does the first line earn the tap?",
].join("\n");

// ---------------------------------------------------------------------------
// Parsing — a draft is just body + hashtags, so slides and stories are read
// back out of the body using the "Slide N:" / "Story N:" convention the
// writing rules ask for. A plain caption yields an empty list, and the
// carousel and story gates then do not apply.
// ---------------------------------------------------------------------------

/** What the campaign asked Instagram for. Absent means a plain caption. */
export type InstagramFormat = "caption" | "carousel" | "story";

const SLIDE_LINE = /^\s*slide\s*\d+\s*[:.)-]\s*(.*)$/i;
const STORY_LINE = /^\s*story\s*\d+\s*[:.)-]\s*(.*)$/i;

export type InstagramBodyParts = {
  /** The caption alone, every Slide/Story line removed. This is what publishes. */
  caption: string;
  slides: string[];
  stories: string[];
};

/**
 * Splits a draft body into the caption and its slide and story lines.
 *
 * A draft is only body + hashtags, so a carousel is expressed as
 * "Slide 1:" lines inside the body. Those lines are structure, not
 * caption: they drive slide rendering and must never reach the published
 * caption. A body with no markers is all caption.
 */
export function splitInstagramBody(body: string): InstagramBodyParts {
  const captionLines: string[] = [];
  const slides: string[] = [];
  const stories: string[] = [];

  for (const line of body.split("\n")) {
    const slide = SLIDE_LINE.exec(line);
    if (slide) {
      slides.push(slide[1].trim());
      continue;
    }
    const story = STORY_LINE.exec(line);
    if (story) {
      stories.push(story[1].trim());
      continue;
    }
    captionLines.push(line);
  }

  return {
    caption: captionLines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    slides,
    stories,
  };
}

/** The publishable caption: body with slide and story lines stripped. */
export function instagramCaption(body: string): string {
  return splitInstagramBody(body).caption;
}

export function parseCarouselSlides(body: string): string[] {
  return splitInstagramBody(body).slides;
}

export function parseStoryFrames(body: string): string[] {
  return splitInstagramBody(body).stories;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Counts emoji, collapsing ZWJ sequences and variation selectors so a
 * single rendered glyph counts once.
 */
export function countEmoji(text: string): number {
  const matches = text.match(
    /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu,
  );
  return matches ? matches.length : 0;
}

function containsAny(text: string, phrases: readonly string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some((phrase) => lower.includes(phrase));
}

// ---------------------------------------------------------------------------
// Sanitizer — mechanical fixes only. Hook quality, CTA strength and slide
// structure are deliberately left alone so the critic has to fail them and
// the writer has to genuinely fix them.
// ---------------------------------------------------------------------------

function normalizeTag(tag: string): string {
  const bare = tag.trim().replace(/^#+/, "");
  return bare ? `#${bare}` : "";
}

/** Dedupes case-insensitively, keeps first occurrence, caps at the limit. */
function uniqueTags(hashtags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of hashtags) {
    const normal = normalizeTag(tag);
    if (!normal) continue;
    const key = normal.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normal);
    if (out.length >= INSTAGRAM_MAX_HASHTAGS) break;
  }
  return out;
}

export function sanitizeInstagramDraft(draft: Draft): Draft {
  if (draft.platform !== "instagram") return draft;
  return {
    ...draft,
    body: draft.body
      .replace(/\r\n/g, "\n")
      // Indentation is never meaningful in a caption, and the model likes
      // to leave it behind when it writes "Slide N:" lines.
      .replace(/^[ \t]+/gm, "")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    hashtags: uniqueTags(draft.hashtags),
  };
}

export function applyInstagramAgent(draft: Draft): Draft {
  return sanitizeInstagramDraft(draft);
}

// ---------------------------------------------------------------------------
// Hard gates — Instagram only. Plain code, not the model.
// ---------------------------------------------------------------------------

export function instagramGateFailures(
  draft: Draft,
  options: { format?: InstagramFormat } = {},
): string[] {
  if (draft.platform !== "instagram") return [];

  const failures: string[] = [];
  const { caption, slides, stories } = splitInstagramBody(draft.body);

  // A format the campaign asked for but the writer never produced. Checked
  // before anything else: the rest of the gates would pass a carousel that
  // is silently just a caption.
  if (options.format === "carousel" && slides.length === 0) {
    failures.push(
      "Carousel requested but no slide markers — write the slides as \"Slide 1:\", \"Slide 2:\" lines.",
    );
  }
  if (options.format === "story" && stories.length === 0) {
    failures.push(
      "Story requested but no story markers — write the frames as \"Story 1:\", \"Story 2:\" lines.",
    );
  }

  if (caption.length > INSTAGRAM_MAX_CAPTION_CHARS) {
    failures.push(
      `Caption is ${caption.length}/${INSTAGRAM_MAX_CAPTION_CHARS} characters — cut ${caption.length - INSTAGRAM_MAX_CAPTION_CHARS}.`,
    );
  }

  if (draft.hashtags.length > INSTAGRAM_MAX_HASHTAGS) {
    failures.push(
      `${draft.hashtags.length} hashtags — Instagram posts here use at most ${INSTAGRAM_MAX_HASHTAGS}.`,
    );
  }

  const firstLine = caption.split("\n")[0]?.trim() ?? "";
  if (firstLine.length > INSTAGRAM_HOOK_MAX_CHARS) {
    failures.push(
      `The hook is ${firstLine.length} characters — Instagram cuts it off at about ${INSTAGRAM_HOOK_MAX_CHARS}. Tighten the first line.`,
    );
  }

  const emoji = countEmoji(caption);
  if (emoji > INSTAGRAM_MAX_EMOJI) {
    failures.push(
      `${emoji} emoji — keep it to ${INSTAGRAM_MAX_EMOJI} or fewer.`,
    );
  }

  if (slides.length > 0) {
    if (
      slides.length < INSTAGRAM_MIN_SLIDES ||
      slides.length > INSTAGRAM_MAX_SLIDES
    ) {
      failures.push(
        `${slides.length} carousel slides — use between ${INSTAGRAM_MIN_SLIDES} and ${INSTAGRAM_MAX_SLIDES}.`,
      );
    }

    const longSlides = slides
      .map((text, index) => ({ index: index + 1, words: wordCount(text) }))
      .filter((slide) => slide.words > INSTAGRAM_SLIDE_MAX_WORDS);
    if (longSlides.length > 0) {
      const first = longSlides[0];
      failures.push(
        `Slide ${first.index} is ${first.words} words — keep every slide under ${INSTAGRAM_SLIDE_MAX_WORDS}.`,
      );
    }

    const lastSlide = slides[slides.length - 1];
    if (!containsAny(lastSlide, INSTAGRAM_CTA_CUES)) {
      failures.push(
        `The last slide is not a CTA. End on one clear ask: save, share, DM, or link in bio.`,
      );
    }
  }

  if (stories.length > 0) {
    for (let i = 0; i < stories.length; i += INSTAGRAM_STICKER_WINDOW) {
      const window = stories.slice(i, i + INSTAGRAM_STICKER_WINDOW);
      if (!window.some((story) => containsAny(story, INSTAGRAM_STICKERS))) {
        failures.push(
          `Stories ${i + 1}-${i + window.length} have no interactive sticker — use one in at least 1 of every ${INSTAGRAM_STICKER_WINDOW}.`,
        );
        break;
      }
    }
  }

  return failures;
}
