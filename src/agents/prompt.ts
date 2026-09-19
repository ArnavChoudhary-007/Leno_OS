import { getEnabledPlaybooks } from "./platforms";

/**
 * Every agent gets the same company context in its system prompt, plus
 * the rule that matters most: it writes, it never publishes.
 */
export function systemPrompt(role: string, brandCard: string): string {
  return [
    role,
    "",
    "You are working for this brand. Everything you produce must sound like it.",
    "",
    "=== BRAND CARD ===",
    brandCard,
    "=== END BRAND CARD ===",
    "",
    "You never publish anything and you never claim to have published anything.",
    "A human approves every post before it goes out.",
  ].join("\n");
}

/** Playbook block for the platforms in play, used by the writer and critic. */
export function playbookBlock(platforms: string[]): string {
  return getEnabledPlaybooks()
    .filter((p) => platforms.includes(p.id))
    .map((p) =>
      [
        `[${p.id}] ${p.displayName}`,
        `  hard limit: ${p.maxChars} characters INCLUDING hashtags`,
        `  hashtags: at most ${p.maxHashtags}`,
        `  format: ${p.formatNotes}`,
        `  tone: ${p.toneNotes}`,
        p.requiresImage ? "  ships with an image — write the caption" : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
}
