import type { Draft } from "@/shared/types";

/** Inflated vocabulary the LinkedIn specialist must not use. */
export const LINKEDIN_INFLATED_WORDS = [
  "delve",
  "embark",
  "foster",
  "leverage",
  "harness",
  "revolutionize",
  "transformative",
  "seamless",
  "seamlessly",
  "robust",
  "innovative",
  "groundbreaking",
  "game-changing",
  "game changer",
  "multifaceted",
  "nuanced",
  "landscape",
  "ecosystem",
  "paradigm",
  "paradigm shift",
  "testament",
  "pivotal",
  "remarkable",
  "exciting journey",
  "unlock",
  "empower",
  "redefine",
  "navigate",
  "at scale",
  "in today's fast-paced world",
  "in today's digital age",
  "in today's rapidly evolving",
  "supercharge",
  "dive into",
  "let's unpack",
  "buckle up",
  "in a nutshell",
  "synergy",
] as const;

export const LINKEDIN_AI_PATTERNS = [
  "it's not just",
  "this isn't about",
  "here's the thing",
  "here's what i learned",
  "the result?",
  "let that sink in",
  "read that again",
  "think about it",
  "and that's when",
  "that's the real lesson",
  "the future of",
  "at the end of the day",
  "one thing i've learned",
  "there's a lesson here",
  "most people think",
  "the truth is",
  "here's why this matters",
] as const;

export const LINKEDIN_CLICHE_CTAS = [
  "what do you think?",
  "agree?",
  "thoughts?",
  "let me know in the comments",
  "follow for more",
  "save this post",
  "share this with someone",
] as const;

export const LINKEDIN_COMPANY_OPENINGS = [
  "we are thrilled to announce",
  "we are excited to share",
  "we're proud to unveil",
  "we are proud to announce",
  "proud to share",
  "thrilled to share",
] as const;

export const LINKEDIN_CLICKBAIT_HOOKS = [
  "stop scrolling",
  "5 things you need to know",
  "here's something nobody tells you",
  "you won't believe this",
  "let me tell you a secret",
] as const;

export const LINKEDIN_MAX_HASHTAGS = 3;

/**
 * 21-rule LinkedIn specialist instruction. Fed to the writer/critic when
 * LinkedIn is in the campaign. Agents still never publish.
 */
export const LINKEDIN_WRITING_RULES = [
  "You are the LinkedIn specialist. Write like a real person who knows the topic, not like an AI or a press office.",
  "NEVER invent human experience: no fake stories, emotions, quotes, metrics, or customer reactions. Use only facts in the brief and brand card.",
  "Ordinary words. Ban: delve, leverage, foster, revolutionize, transformative, seamless, robust, innovative, game-changing, paradigm, unlock, empower, at scale.",
  "No em dashes. Use commas, periods, or colons.",
  "Do not use AI formulas: It's not X it's Y, Here's the thing, Let that sink in, Read that again, The truth is, Here's why this matters.",
  "Vary sentence length. Paragraphs of 2-3 sentences. Do not put every sentence on its own line.",
  "Specificity over vibe: numbers, product names, decisions, constraints from the brief. If a claim is not in the input, drop it.",
  "Hooks: open with a concrete observation, number, or contradiction. Never Stop scrolling / You won't believe / 5 things you need to know.",
  "Company posts: do not open We are thrilled/excited/proud to announce. Lead with the thing itself.",
  "No forced CTA. Never end with Agree? Thoughts? What do you think? Follow for more. End when the thought is done, or one low-friction next step from the brief.",
  "Hashtags: at most 3, highly relevant, or none. No emoji wallpaper.",
  "Final test: would a real person type this into LinkedIn? If it could fit any company, make it more specific.",
].join("\n");

function wordBoundaryPattern(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  const startsWithWord = /^\w/.test(phrase);
  const endsWithWord = /\w$/.test(phrase);
  return new RegExp(
    `${startsWithWord ? "\\b" : ""}${escaped}${endsWithWord ? "\\b" : ""}`,
    "i",
  );
}

function findHits(text: string, phrases: readonly string[]): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  for (const phrase of phrases) {
    if (wordBoundaryPattern(phrase).test(lower) && !hits.includes(phrase)) {
      hits.push(phrase);
    }
  }
  return hits;
}

function cleanLinkedInText(text: string): string {
  let next = text
    .replace(/[\u2014\u2013\u2012\u2015]/g, ", ")
    .replace(/ -- /g, ", ");

  for (const cta of LINKEDIN_CLICHE_CTAS) {
    next = next.replace(wordBoundaryPattern(cta), "");
  }

  return next
    .replace(/,\s*,/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Deterministic LinkedIn specialist pass. Strips em dashes and bait CTAs,
 * caps hashtags. Buzzwords stay in the text so the critic can force a rewrite.
 */
export function sanitizeLinkedInDraft(draft: Draft): Draft {
  if (draft.platform !== "linkedin") return draft;
  return {
    ...draft,
    body: cleanLinkedInText(draft.body),
    hashtags: draft.hashtags.slice(0, LINKEDIN_MAX_HASHTAGS),
  };
}

/** Extra hard gates for LinkedIn only. Runs in plain code, not the model. */
export function linkedinGateFailures(text: string): string[] {
  const failures: string[] = [];

  if (/[\u2014\u2013\u2012\u2015]/.test(text) || text.includes(" -- ")) {
    failures.push("Remove em dashes. Use a comma, period, or colon.");
  }

  const buzz = findHits(text, LINKEDIN_INFLATED_WORDS);
  if (buzz.length > 0) {
    failures.push(`Replace inflated words: ${buzz.slice(0, 4).join(", ")}`);
  }

  const formulas = findHits(text, LINKEDIN_AI_PATTERNS);
  if (formulas.length > 0) {
    failures.push(`Drop the AI formula "${formulas[0]}"`);
  }

  const openings = findHits(text, LINKEDIN_COMPANY_OPENINGS);
  if (openings.length > 0) {
    failures.push(`Do not open with "${openings[0]}". Lead with the thing itself.`);
  }

  const bait = findHits(text, LINKEDIN_CLICHE_CTAS);
  if (bait.length > 0) {
    failures.push(`Remove the engagement-bait CTA "${bait[0]}"`);
  }

  const clickbait = findHits(text, LINKEDIN_CLICKBAIT_HOOKS);
  if (clickbait.length > 0) {
    failures.push(`Replace the clickbait hook "${clickbait[0]}"`);
  }

  return failures;
}

export function applyLinkedInAgent(draft: Draft): Draft {
  return sanitizeLinkedInDraft(draft);
}
