import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { runSteps } from "@/db/schema";

/** Every step the orchestrator can log, in the order they normally happen. */
export type RunStepName =
  | "plan"
  | "strategy"
  | "draft"
  | "critique"
  | "revise"
  | "error";

export type RunStep = typeof runSteps.$inferSelect;

/** Append-only audit trail: what ran, which model answered, how long it took. */
export async function logStep(
  campaignId: string,
  step: RunStepName,
  model: string,
  output: unknown,
  durationMs: number,
): Promise<void> {
  await db.insert(runSteps).values({
    campaign_id: campaignId,
    step,
    model,
    output,
    duration_ms: Math.round(durationMs),
  });
}

export async function getRunSteps(campaignId: string): Promise<RunStep[]> {
  return db
    .select()
    .from(runSteps)
    .where(eq(runSteps.campaign_id, campaignId))
    .orderBy(asc(runSteps.created_at));
}
