import type { BrandProfile, Critique, Draft, Plan } from "@/shared/types";

/**
 * Critic rubric. Weights must sum to 1. Used both to prompt the critic
 * model and to compute/validate the weighted score in code.
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
 * Hard gates checked in plain code before a draft reaches the critic
 * model at all: platform limits (see agents/platforms/index.ts
 * validateDraft) and banned terms. TODO: replace with a real,
 * brand-configurable list.
 */
export const BANNED_TERMS: string[] = [
  "guaranteed",
  "miracle",
  "cure",
  "risk-free",
];

/**
 * Runs the critic agent against one draft and returns a scored critique.
 * TODO: implement — call the critic model (see tools/llm.ts), validate its
 * output against CritiqueSchema, and compute `weighted`/`pass` from
 * RUBRIC_WEIGHTS and PASS_THRESHOLD rather than trusting the model's math.
 */
export async function critique(
  draft: Draft,
  brand: BrandProfile,
  plan: Plan,
): Promise<Critique> {
  void draft;
  void brand;
  void plan;
  throw new Error("critique() is not implemented yet");
}
