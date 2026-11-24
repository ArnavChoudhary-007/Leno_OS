import { getEnabledPlaybooks } from "./platforms";
import { LINKEDIN_WRITING_RULES } from "./platforms/linkedin-rules";
import { INSTAGRAM_WRITING_RULES } from "./platforms/instagram-rules";
import { getModelContext } from "@/tools/run-context";

/**
 * Every agent gets the same company context in its system prompt, plus
 * the rule that matters most: it writes, it never publishes.
 */
export function systemPrompt(role: string, brandCard: string): string {
  const useVoice = getModelContext()?.options.brandVoice !== false;
  const card = useVoice ? brandCard : brandCard.split("\n\n").filter((section) => !/^(Tone:|Example posts:)/.test(section)).join("\n\n");
  return [
    role,
    "",
    useVoice ? "You are working for this brand. Everything you produce must sound like it." : "Use a clear neutral voice. Preserve brand facts and constraints without imitating its example posts.",
    "",
    "=== BRAND CARD ===",
    card,
    "=== END BRAND CARD ===",
    "",
    "You never publish anything and you never claim to have published anything.",
    "A human approves every post before it goes out.",
  ].join("\n");
}

/** Playbook block for the platforms in play, used by the writer and critic. */
export function playbookBlock(platforms: string[]): string {
  const body = getEnabledPlaybooks()
    .filter((p) => platforms.includes(p.id))
    .map((p) =>
      [
        `[${p.id}] ${p.displayName}`,
        `  hard limit: ${p.maxChars} characters INCLUDING hashtags`,
        `  hashtags: at most ${p.maxHashtags}`,
        `  format: ${p.formatNotes}`,
        `  tone: ${p.toneNotes}`,
        p.requiresImage ? "  ships with an image — write the caption" : null,
        p.imageSpec
          ? `  image: ${p.imageSpec.ratio} (${p.imageSpec.width}×${p.imageSpec.height}), cover-cropped from the campaign photo (GPT Image 1.5 when none was uploaded)`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");

  return [
    body,
    ...(platforms.includes("linkedin") ? [
      "",
      "=== LINKEDIN SPECIALIST ===",
      LINKEDIN_WRITING_RULES,
      "=== END LINKEDIN SPECIALIST ===",
    ] : []),
    ...(platforms.includes("instagram") ? [
      "",
      "=== INSTAGRAM SPECIALIST ===",
      INSTAGRAM_WRITING_RULES,
      "=== END INSTAGRAM SPECIALIST ===",
    ] : []),
  ].join("\n");
}
