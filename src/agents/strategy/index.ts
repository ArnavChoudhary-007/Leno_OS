import { StrategySchema } from "@/shared/schemas";
import type { Plan, Strategy } from "@/shared/types";
import { generateStructured, type StructuredResult } from "@/tools/llm";
import { playbookBlock, systemPrompt } from "../prompt";

/**
 * Decides the angle before anyone writes a word: how to come at the key
 * message, three competing hooks, the call to action, and a note on what
 * changes per platform.
 */
export async function strategy(
  plan: Plan,
  brandCard: string,
): Promise<StructuredResult<Strategy>> {
  return generateStructured({
    role: "writer",
    schema: StrategySchema,
    system: systemPrompt(
      "You are the content strategist for a social distribution system.",
      brandCard,
    ),
    prompt: [
      "Set the creative direction for this campaign.",
      "",
      `GOAL: ${plan.goal}`,
      `AUDIENCE: ${plan.audience}`,
      `KEY MESSAGE: ${plan.key_message}`,
      `PLATFORMS: ${plan.platforms.join(", ")}`,
      "",
      "PLATFORM PLAYBOOKS:",
      playbookBlock(plan.platforms),
      "",
      "angle: the specific take that makes this worth reading. Not a summary of the goal.",
      "hooks: exactly 3 opening lines, genuinely different from each other.",
      "cta: what you want the reader to do, in the brand's voice.",
      "platform_notes: one line per platform listed above on how the angle shifts there.",
      "Only include keys for those platforms.",
    ].join("\n"),
  });
}
