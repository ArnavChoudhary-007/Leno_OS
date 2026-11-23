import { PlanSchema, PlatformIdSchema } from "@/shared/schemas";
import type { Plan, PlatformId } from "@/shared/types";
import { generateStructured, type StructuredResult } from "@/tools/llm";
import { getEnabledPlaybooks } from "../platforms";
import { systemPrompt } from "../prompt";

/** The line Create appends to a brief to pin the platforms the person picked. */
const PLATFORMS_LINE = /^Platforms:\s*(.+)$/im;

/**
 * Pin the requested platforms into the brief itself, so the choice travels
 * with the campaign row (the brief is stored verbatim) without a schema
 * change. `requestedPlatforms` reads it back for the planner.
 */
export function withRequestedPlatforms(
  brief: string,
  platforms: readonly PlatformId[] | undefined,
): string {
  const clean = brief.replace(PLATFORMS_LINE, "").trimEnd();
  if (!platforms || platforms.length === 0) return clean;
  return `${clean}\n\nPlatforms: ${[...new Set(platforms)].join(", ")}`;
}

/** Platforms pinned by `withRequestedPlatforms`, or null if none were. */
export function requestedPlatforms(brief: string): PlatformId[] | null {
  const match = PLATFORMS_LINE.exec(brief);
  if (!match) return null;
  const parsed = PlatformIdSchema.array().safeParse(
    match[1]
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean),
  );
  return parsed.success && parsed.data.length > 0 ? parsed.data : null;
}

/**
 * Turns a free-text brief into a concrete goal, audience, key message and
 * platform list. The model may only choose from enabled platforms, and
 * whatever it returns is filtered against the registry in code.
 */
export async function plan(
  brief: string,
  brandCard: string,
): Promise<StructuredResult<Plan>> {
  const all = getEnabledPlaybooks().map((p) => p.id);
  // A person's explicit pick narrows the menu; disabled platforms never pass.
  const requested = requestedPlatforms(brief);
  const narrowed = requested ? all.filter((p) => requested.includes(p)) : all;
  const enabled = narrowed.length > 0 ? narrowed : all;

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
      requested
        ? "The person already chose these platforms. Use all of them."
        : "Pick every platform where this campaign genuinely fits — usually all of them.",
      "",
      "goal: one sentence, measurable, what this campaign is for.",
      "audience: who specifically, grounded in the brand's audience.",
      "key_message: the single idea every post must land. One sentence.",
    ].join("\n"),
  });

  // Never trust the model's platform list — intersect it with the registry.
  const allowed = new Set<PlatformId>(enabled);
  const platforms = requested
    ? enabled
    : result.object.platforms.filter((p) => allowed.has(p));

  return {
    ...result,
    object: {
      ...result.object,
      platforms: platforms.length > 0 ? [...new Set(platforms)] : enabled,
    },
  };
}
