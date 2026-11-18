import { PlanSchema } from "@/shared/schemas";
import type { Plan, PlatformId } from "@/shared/types";
import { generateStructured, type StructuredResult } from "@/tools/llm";
import { getEnabledPlaybooks } from "../platforms";
import { systemPrompt } from "../prompt";
import { getModelContext } from "@/tools/run-context";

/**
 * Turns a free-text brief into a concrete goal, audience, key message and
 * platform list. The model may only choose from enabled platforms, and
 * whatever it returns is filtered against the registry in code.
 */
export async function plan(
  brief: string,
  brandCard: string,
): Promise<StructuredResult<Plan>> {
  const options = getModelContext()?.options;
  const requested = options?.platforms;
  const enabled = getEnabledPlaybooks().map((p) => p.id).filter((platform) => !requested || requested.includes(platform));
  if (!enabled.length) throw new Error("Select at least one enabled platform.");

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
      `INPUT MODE: ${options?.source ?? "idea"}.`,
      options?.source === "source" || options?.source === "repurpose"
        ? "Adapt the supplied source text, preserving its facts and meaning. URLs are references only; their contents have not been fetched."
        : "Develop the supplied idea or campaign objective into a coordinated distribution plan.",
      "",
      `Choose platforms only from: ${enabled.join(", ")}.`,
      "Pick every platform where this campaign genuinely fits — usually all of them.",
      "",
      "goal: one sentence, measurable, what this campaign is for.",
      "audience: who specifically, grounded in the brand's audience.",
      "key_message: the single idea every post must land. One sentence.",
    ].join("\n"),
  });

  // Never trust the model's platform list — intersect it with the registry.
  const allowed = new Set<PlatformId>(enabled);
  const platforms = result.object.platforms.filter((p) => allowed.has(p));

  return {
    ...result,
    object: {
      ...result.object,
      platforms: requested ? enabled : platforms.length > 0 ? [...new Set(platforms)] : enabled,
    },
  };
}
