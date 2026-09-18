import type { BrandProfile, Plan, Strategy } from "@/shared/types";
import type { ResearchNotes } from "../research";

/**
 * Strategy agent: turns a plan + research notes into an angle, hooks,
 * and a CTA.
 * TODO: implement — call the writer model (tools/llm.ts) and validate
 * its output against StrategySchema before returning it.
 */
export async function buildStrategy(
  brand: BrandProfile,
  plan: Plan,
  researchNotes: ResearchNotes,
): Promise<Strategy> {
  void brand;
  void plan;
  void researchNotes;
  throw new Error("buildStrategy() is not implemented yet");
}
