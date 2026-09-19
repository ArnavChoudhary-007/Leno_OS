import { asc, desc, eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { runSteps } from "@/db/schema";
import type { RunPhase } from "@/shared/types";

/** What ran inside a phase. */
export type RunStepName =
  | "load_context"
  | "plan"
  | "strategy"
  | "roster"
  | "draft"
  | "critique"
  | "revise"
  | "summary"
  | "error";

export type RunStep = typeof runSteps.$inferSelect;

/**
 * Append-only audit trail: which phase, what ran inside it, which model
 * answered (null for phases that are plain code), and how long it took.
 */
export async function logStep(
  campaignId: string,
  phase: RunPhase,
  step: RunStepName,
  model: string | null,
  output: unknown,
  durationMs: number,
): Promise<void> {
  await db.insert(runSteps).values({
    campaign_id: campaignId,
    phase,
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

/** When the campaign last showed signs of life — used to spot dead runs. */
export async function getLastStepAt(
  campaignId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ created_at: runSteps.created_at })
    .from(runSteps)
    .where(eq(runSteps.campaign_id, campaignId))
    .orderBy(desc(runSteps.created_at))
    .limit(1);
  return row?.created_at ?? null;
}

/**
 * The most recent output for one step — how a later human-note revision
 * recovers the strategy the original run was written against.
 */
export async function getLatestStepOutput(
  campaignId: string,
  step: RunStepName,
): Promise<unknown | null> {
  const [row] = await db
    .select({ output: runSteps.output })
    .from(runSteps)
    .where(and(eq(runSteps.campaign_id, campaignId), eq(runSteps.step, step)))
    .orderBy(desc(runSteps.created_at))
    .limit(1);
  return row?.output ?? null;
}

export async function getModelsUsed(campaignId: string): Promise<string[]> {
  const rows = await db
    .select({ model: runSteps.model })
    .from(runSteps)
    .where(eq(runSteps.campaign_id, campaignId));

  return [...new Set(rows.map((r) => r.model).filter((m): m is string => !!m))];
}
