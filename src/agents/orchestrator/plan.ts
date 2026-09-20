import { PlanSchema } from "@/shared/schemas";
import type { Plan, PlatformId } from "@/shared/types";
import { generateStructured, type StructuredResult } from "@/tools/llm";
import { getEnabledPlaybooks } from "../platforms";
import { systemPrompt } from "../prompt";

/**
 * Turns a free-text brief into a concrete goal, audience, key message and
 * platform list. The model may only choose from enabled platforms, and
 * whatever it returns is filtered against the registry in code.
 */
export async function plan(
  brief: string,
  brandCard: string,
): Promise<StructuredResult<Plan>> {
  const enabled = getEnabledPlaybooks().map((p) => p.id);

  const result = await generateStructured({
    role: "writer",
    schema: PlanSchema,
    system: systemPrompt(
      "You are the campaign planner for a social distribution system.",
      brandCard,
    ),
    prompt: [
      "Turn this campaign brief into a plan.",
      "",
      `BRIEF: ${brief}`,
      "",
      `Choose platforms only from: ${enabled.join(", ")}.`,
      "Pick every platform where this campaign genuinely fits — usually all of them.",
      "",
      "goal: one sentence, measurable, what this campaign is for.",
      "audience: who specifically, grounded in the brand's audience.",
      "key_message: the single idea every post must land. One sentence.",
      ...(enabled.includes("instagram")
        ? [
            "instagram_format: carousel for anything educational or list-shaped,",
            "story for something quick and interactive, caption for a single image.",
          ]
        : []),
    ].join("\n"),
  });

  // Never trust the model's platform list — intersect it with the registry.
  const allowed = new Set<PlatformId>(enabled);
  const platforms = result.object.platforms.filter((p) => allowed.has(p));

  return {
    ...result,
    object: {
      ...result.object,
      platforms: platforms.length > 0 ? [...new Set(platforms)] : enabled,
    },
  };
}
