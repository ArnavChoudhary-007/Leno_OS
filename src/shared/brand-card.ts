/**
 * Builds the plain-text "brand card" every agent prompt is given, and
 * estimates its token cost. Pure and dependency-free (no db import) so it
 * can run both on the server (src/memory/context.ts re-exports it) and in
 * the browser (the /brand page's live preview imports it directly).
 */
import type { BrandProfileInput } from "./types";

const MAX_CARD_CHARS = 4000;

function bulletList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "(none listed)";
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function buildBrandCard(profile: BrandProfileInput): string {
  const head = [
    `Brand: ${profile.name}\n${profile.one_liner}`,
    `Positioning:\n${profile.positioning}`,
    `Audience:\n${profile.audience}`,
    `Products:\n${bulletList(profile.products)}`,
    `Competitors:\n${bulletList(profile.competitors)}`,
    `Tone: ${profile.tone_words.join(", ")}`,
    `Do:\n${bulletList(profile.dos)}`,
    `Don't:\n${bulletList(profile.donts)}`,
    `Visual identity:\nPrimary ${profile.primary_color}, Secondary ${profile.secondary_color}`,
  ].join("\n\n");

  const examplesHeader = "Example posts:";
  const budget = Math.max(0, MAX_CARD_CHARS - head.length - examplesHeader.length - 2);

  const lines: string[] = [];
  let used = 0;
  for (const [index, post] of profile.example_posts.entries()) {
    const prefix = `${index + 1}. `;
    const separator = lines.length > 0 ? 1 : 0; // "\n" joining the previous line
    const lineBudget = budget - used - separator;
    if (lineBudget <= prefix.length) break;

    const maxPostChars = lineBudget - prefix.length;
    const truncated =
      post.length > maxPostChars
        ? `${post.slice(0, Math.max(0, maxPostChars - 1))}…`
        : post;

    const line = `${prefix}${truncated}`;
    lines.push(line);
    used += line.length + separator;
  }

  return `${head}\n\n${examplesHeader}\n${lines.join("\n")}`;
}
