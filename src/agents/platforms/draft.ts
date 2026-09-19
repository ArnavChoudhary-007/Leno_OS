import { DraftSetSchema } from "@/shared/schemas";
import type { Critique, Draft, Plan, PlatformId, Strategy } from "@/shared/types";
import { generateStructured, type StructuredResult } from "@/tools/llm";
import { playbookBlock, systemPrompt } from "../prompt";
import { PLATFORM_PLAYBOOKS } from ".";

const WRITER_ROLE =
  "You are the staff writer for a social distribution system. You write posts that sound like a person, not a brand deck.";

function noteFor(strategy: Strategy, platform: PlatformId): string {
  return strategy.platform_notes[platform] ?? "";
}

function briefFor(plan: Plan, strategy: Strategy): string[] {
  return [
    `GOAL: ${plan.goal}`,
    `AUDIENCE: ${plan.audience}`,
    `KEY MESSAGE: ${plan.key_message}`,
    `ANGLE: ${strategy.angle}`,
    `HOOKS TO DRAW FROM: ${strategy.hooks.join(" | ")}`,
    `CTA: ${strategy.cta}`,
  ];
}

/**
 * ONE call that writes every platform's post. Doing this in a single pass
 * keeps the posts aware of each other — they should feel like one campaign,
 * not four strangers — and keeps the run to a fixed LLM budget.
 */
export async function draftAll(
  plan: Plan,
  strategy: Strategy,
  brandCard: string,
): Promise<StructuredResult<Draft[]>> {
  const result = await generateStructured({
    role: "writer",
    schema: DraftSetSchema,
    system: systemPrompt(WRITER_ROLE, brandCard),
    prompt: [
      `Write one post for each of these platforms: ${plan.platforms.join(", ")}.`,
      "Return exactly one draft per platform, no extras.",
      "",
      ...briefFor(plan, strategy),
      "",
      "PER-PLATFORM ANGLE:",
      ...plan.platforms.map((p) => `[${p}] ${noteFor(strategy, p)}`),
      "",
      "PLATFORM PLAYBOOKS — the character limits are hard failures:",
      playbookBlock(plan.platforms),
      "",
      "Match the voice in the brand's example posts. Respect its do's and don'ts.",
      "body: the post text WITHOUT hashtags.",
      "hashtags: put tags here, not in the body. Use [] when the platform doesn't want any.",
      "The character limit counts body + hashtags together, so leave room.",
      "Vary the posts. Do not paste the same sentences across platforms.",
    ].join("\n"),
  });

  return { ...result, object: dedupeByPlatform(result.object.drafts, plan.platforms) };
}

/**
 * ONE call that rewrites only the posts that failed, with their critiques
 * attached. Platforms that already passed are left alone.
 */
export async function reviseDrafts(
  failing: { draft: Draft; critique: Critique }[],
  plan: Plan,
  strategy: Strategy,
  brandCard: string,
): Promise<StructuredResult<Draft[]>> {
  const platforms = failing.map((f) => f.draft.platform);

  const result = await generateStructured({
    role: "writer",
    schema: DraftSetSchema,
    system: systemPrompt(WRITER_ROLE, brandCard),
    prompt: [
      `Rewrite these posts. Return one draft for each of: ${platforms.join(", ")}.`,
      "Nothing else — do not touch platforms that are not listed.",
      "",
      ...briefFor(plan, strategy),
      "",
      "PLATFORM PLAYBOOKS:",
      playbookBlock(platforms),
      "",
      "FAILED DRAFTS AND WHAT'S WRONG WITH THEM:",
      ...failing.map((f) =>
        [
          "",
          `[${f.draft.platform}] scored ${f.critique.weighted.toFixed(2)}`,
          `CURRENT BODY: ${f.draft.body}`,
          `CURRENT HASHTAGS: ${f.draft.hashtags.join(" ") || "(none)"}`,
          ...(f.critique.gate_failures.length
            ? [`HARD LIMITS BREACHED: ${f.critique.gate_failures.join("; ")}`]
            : []),
          `FIXES REQUIRED: ${f.critique.fix_list.map((x, i) => `${i + 1}. ${x}`).join(" ")}`,
        ].join("\n"),
      ),
      "",
      "Apply every fix listed. Keep what already worked — this is a revision, not a restart.",
      "If a hard limit was breached, cut real words; do not trim punctuation and call it done.",
    ].join("\n"),
  });

  return { ...result, object: dedupeByPlatform(result.object.drafts, platforms) };
}

/** Keeps the first draft per requested platform and drops anything unasked for. */
function dedupeByPlatform(drafts: Draft[], wanted: PlatformId[]): Draft[] {
  const seen = new Map<PlatformId, Draft>();
  for (const draft of drafts) {
    if (!PLATFORM_PLAYBOOKS[draft.platform]?.enabled) continue;
    if (!wanted.includes(draft.platform)) continue;
    if (!seen.has(draft.platform)) seen.set(draft.platform, draft);
  }
  return wanted.map((p) => seen.get(p)).filter((d): d is Draft => Boolean(d));
}
