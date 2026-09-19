import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { runSteps } from "@/db/schema";
import type { RunStepName } from "@/shared/types";

export type { RunStepName };

export type RunStep = typeof runSteps.$inferSelect;

/** Append-only audit trail: what ran, which model answered, how long it took. */
export async function logStep(
  campaignId: string,
  step: RunStepName,
  model: string,
  output: unknown,
  durationMs: number,
  workspaceId?: string,
): Promise<void> {
  let workspace_id = workspaceId;
  if (!workspace_id) {
    const { getCampaign } = await import("./campaigns");
    const campaign = await getCampaign(campaignId);
    workspace_id = campaign?.workspace_id;
  }
  if (!workspace_id) {
    throw new Error(`Cannot log step: campaign ${campaignId} has no workspace`);
  }
  await db.insert(runSteps).values({
    workspace_id,
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

export async function latestWorkspaceRunStep(
  workspaceId: string,
): Promise<RunStep | null> {
  const [row] = await db
    .select()
    .from(runSteps)
    .where(eq(runSteps.workspace_id, workspaceId))
    .orderBy(desc(runSteps.created_at))
    .limit(1);
  return row ?? null;
}

export async function listWorkspaceRunSteps(
  workspaceId: string,
): Promise<RunStep[]> {
  return db
    .select()
    .from(runSteps)
    .where(eq(runSteps.workspace_id, workspaceId))
    .orderBy(asc(runSteps.created_at));
}
