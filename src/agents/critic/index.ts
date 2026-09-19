import { CritiqueLLMSetSchema } from "@/shared/schemas";
import type { Critique, CritiqueLLM, Draft, Plan } from "@/shared/types";
import { generateStructured, type StructuredResult } from "@/tools/llm";
import { composePost, validateDraft } from "../platforms";
import { linkedinGateFailures } from "../platforms/linkedin-rules";
import { playbookBlock, systemPrompt } from "../prompt";

/**
 * Critic rubric. Weights must sum to 1. Used both to prompt the critic
 * model and to compute the weighted score in code.
 */
export const RUBRIC_WEIGHTS = {
  brand_voice: 0.3,
  goal_fit: 0.25,
  craft: 0.25,
  platform_fit: 0.2,
} as const;

export const PASS_THRESHOLD = 0.8;
export const MAX_REVISION_ROUNDS = 3;

/**
 * Hard gates checked in plain code before the critic's score counts for
 * anything: platform limits (agents/platforms validateDraft) and banned
 * terms. TODO: make the banned list brand-configurable.
 */
export const BANNED_TERMS: string[] = [
  "guaranteed",
  "miracle",
  "cure",
  "risk-free",
];

/** Weighted score from the rubric. Never taken from the model. */
export function weightedScore(scores: CritiqueLLM["scores"]): number {
  return (
    RUBRIC_WEIGHTS.brand_voice * scores.brand_voice +
    RUBRIC_WEIGHTS.goal_fit * scores.goal_fit +
    RUBRIC_WEIGHTS.craft * scores.craft +
    RUBRIC_WEIGHTS.platform_fit * scores.platform_fit
  );
}

/** Platform limits and banned terms, all decided in code. */
export function hardGates(draft: Draft): string[] {
  const post = composePost(draft);
  const failures = validateDraft(draft.platform, post, draft.hashtags).errors;

  const lower = post.toLowerCase();
  for (const term of BANNED_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      failures.push(`Remove the banned term "${term}"`);
    }
  }
  if (draft.platform === "linkedin") {
    failures.push(...linkedinGateFailures(post));
  }
  return failures;
}

/**
 * ONE call scoring every draft, followed by the parts the model doesn't
 * get a vote on: the hard gates, the weighted score and the verdict.
 */
export async function critique(
  drafts: Draft[],
  plan: Plan,
  brandCard: string,
  threshold: number = PASS_THRESHOLD,
): Promise<StructuredResult<Critique[]>> {
  const platforms = drafts.map((d) => d.platform);

  const result = await generateStructured({
    role: "critic",
    schema: CritiqueLLMSetSchema,
    system: systemPrompt(
      [
        "You are the quality critic for a social distribution system.",
        "You are strict. Most drafts are mediocre and should score accordingly —",
        "0.9+ means you would publish it as-is with pride.",
        "You quote the exact phrase you object to.",
        "You never rewrite the post yourself; you say what is wrong and let the writer fix it.",
      ].join("\n"),
      brandCard,
    ),
    prompt: [
      `Score one critique for each of these platforms: ${platforms.join(", ")}.`,
      "",
      `GOAL: ${plan.goal}`,
      `AUDIENCE: ${plan.audience}`,
      `KEY MESSAGE: ${plan.key_message}`,
      "",
      "PLATFORM PLAYBOOKS:",
      playbookBlock(platforms),
      "",
      "DRAFTS:",
      ...drafts.map((d) =>
        [
          "",
          `[${d.platform}]`,
          d.body,
          `HASHTAGS: ${d.hashtags.join(" ") || "(none)"}`,
        ].join("\n"),
      ),
      "",
      "Score each 0-1:",
      "brand_voice: does it sound like the brand card's tone, do's and example posts?",
      "goal_fit: does it serve the goal and land the key message?",
      "platform_fit: is it native to that platform, not a repost of a generic caption?",
      "craft: is the hook strong, is it tight, would a real person stop scrolling?",
      platforms.includes("linkedin")
        ? [
            "",
            "For [linkedin] also check the specialist rules: no invented stories, no em dashes,",
            "no inflated words, no AI formulas, no thrilled-to-announce openings, no Agree?/Thoughts? CTA.",
            "Quote the offending phrase.",
          ].join(" ")
        : "",
      "",
      "fix_list: at most 5 specific fixes, each quoting the phrase at fault.",
      "Leave fix_list empty only when the post genuinely needs no changes.",
      "rationale: two sentences on the score.",
    ].join("\n"),
  });

  const byPlatform = new Map(result.object.critiques.map((c) => [c.platform, c]));
  const missing = platforms.filter((p) => !byPlatform.has(p));
  if (missing.length > 0) {
    throw new Error(`Critic skipped platform(s): ${missing.join(", ")}`);
  }

  const critiques: Critique[] = drafts.map((draft) => {
    const llm = byPlatform.get(draft.platform)!;
    const gate_failures = hardGates(draft);
    const weighted = weightedScore(llm.scores);

    return {
      platform: draft.platform,
      scores: llm.scores,
      // Gates stay in gate_failures — fix_list is the model's ≤5 items only.
      fix_list: llm.fix_list,
      rationale: llm.rationale,
      weighted,
      gate_failures,
      pass: weighted >= threshold && gate_failures.length === 0,
    };
  });

  return { ...result, object: critiques };
}
