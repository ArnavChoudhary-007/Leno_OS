import { and, desc, eq, sql, or, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns, drafts } from "@/db/schema";
import { AppError } from "@/shared/errors";
import type { CampaignOptions, CampaignStatus, CampaignSummary, Plan } from "@/shared/types";

export type Campaign = typeof campaigns.$inferSelect;

/** How long a `running` campaign may sit before we treat it as abandoned. */
export const STALE_RUNNING_MS = 30 * 60 * 1000;

export async function insertCampaign(input: {
  workspaceId: string;
  createdBy: string;
  brief: string;
  brandId?: string | null;
  options?: CampaignOptions;
}): Promise<Campaign> {
  const [row] = await db
    .insert(campaigns)
    .values({
      brief: input.brief,
      status: "queued",
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      brand_id: input.brandId ?? null,
      options: input.options,
    })
    .returning();
  return row;
}

export async function listCampaignsInWorkspace(
  workspaceId: string,
  limit = 50,
): Promise<Campaign[]> {
  return db
    .select()
    .from(campaigns)
    .where(eq(campaigns.workspace_id, workspaceId))
    .orderBy(desc(campaigns.created_at))
    .limit(limit);
}

export async function workspaceCampaignStats(workspaceId: string): Promise<{
  running: number;
  total: number;
}> {
  const rows = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.workspace_id, workspaceId));

  let running = 0;
  for (const row of rows) {
    if (row.status === "queued" || row.status === "running") running += 1;
  }
  return { running, total: rows.length };
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1);
  return row ?? null;
}

export async function getCampaignInWorkspace(
  workspaceId: string,
  id: string,
): Promise<Campaign | null> {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.workspace_id, workspaceId)))
    .limit(1);
  return row ?? null;
}

/**
 * The planner produces one Plan. `goal` stores the goal statement for
 * display/filter; `plan` stores the full object.
 */
export async function saveCampaignPlan(id: string, plan: Plan, runId: string): Promise<void> {
  await db
    .update(campaigns)
    .set({ goal: plan.goal, plan })
    .where(and(eq(campaigns.id, id), eq(campaigns.run_id, runId), eq(campaigns.status, "running")));
}

export async function saveBrandSnapshot(
  id: string,
  brandCard: string,
  runId: string,
): Promise<void> {
  await db
    .update(campaigns)
    .set({ brand_snapshot: brandCard })
    .where(and(eq(campaigns.id, id), eq(campaigns.run_id, runId), eq(campaigns.status, "running")));
}

/** Counted in the database so parallel work can't lose an increment. */
export async function countLlmCall(id: string, runId?: string): Promise<void> {
  const updated = await db
    .update(campaigns)
    .set({ llm_calls: sql`${campaigns.llm_calls} + 1` })
    .where(and(eq(campaigns.id, id), runId ? and(eq(campaigns.run_id, runId), eq(campaigns.status, "running")) : undefined))
    .returning({ id: campaigns.id });
  if (!updated.length) throw new AppError("conflict", "This run is no longer active.");
}

export async function finishCampaign(
  id: string,
  status: CampaignStatus,
  summary: CampaignSummary | null,
  runId: string,
): Promise<void> {
  await db
    .update(campaigns)
    .set({ status, summary, finished_at: new Date().toISOString() })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "running"), eq(campaigns.run_id, runId)));
}

export async function getUnfinishedCampaigns(): Promise<Campaign[]> {
  return db.select().from(campaigns).where(or(eq(campaigns.status, "running"), eq(campaigns.status, "queued")));
}

export async function failInterruptedCampaign(campaign: Campaign): Promise<boolean> {
  const updated = await db.update(campaigns).set({ status: "failed", finished_at: new Date().toISOString() })
    .where(and(eq(campaigns.id, campaign.id), eq(campaigns.status, campaign.status),
      campaign.run_id ? eq(campaigns.run_id, campaign.run_id) : isNull(campaigns.run_id),
      campaign.started_at ? eq(campaigns.started_at, campaign.started_at) : isNull(campaigns.started_at)))
    .returning({ id: campaigns.id });
  return updated.length === 1;
}

function isStaleRunning(campaign: Campaign, now = Date.now()): boolean {
  if (campaign.status !== "running") return false;
  if (!campaign.started_at) return true;
  return now - new Date(campaign.started_at).getTime() >= STALE_RUNNING_MS;
}

/**
 * Atomically claims a campaign for an orchestrator run.
 * - `queued` → claim
 * - `running` past STALE_RUNNING_MS → reclaim (process likely died)
 * - anything else → refuse (active run or already finished)
 *
 * Returns true when this caller owns the run.
 */
export async function claimCampaign(
  id: string,
  now = new Date(),
  runId = crypto.randomUUID(),
): Promise<boolean> {
  const rows = await db
    .update(campaigns)
    .set({
      status: "running",
      run_id: runId,
      llm_calls: 0,
      started_at: now.toISOString(),
      finished_at: null,
    })
    .where(and(eq(campaigns.id, id), or(
      eq(campaigns.status, "queued"),
      and(eq(campaigns.status, "running"), or(isNull(campaigns.started_at), lt(campaigns.started_at, new Date(now.getTime() - STALE_RUNNING_MS).toISOString()))),
    )))
    .returning({ id: campaigns.id });
  return rows.length === 1;
}

/**
 * Puts a finished or failed campaign back on the queue so it can be retried.
 * Refuses campaigns that are still actively running (not stale).
 */
export async function requeueCampaign(id: string, onlyFailed = false): Promise<Campaign | null> {
  return db.transaction(async (tx) => {
    const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for("update");
    if (!campaign || (onlyFailed && campaign.status !== "failed")) return null;
    if (campaign.status === "running" && !isStaleRunning(campaign)) throw new AppError("conflict", "Campaign is still running");
    if (campaign.status === "queued") return campaign;
    const [blocked] = await tx.select({ id: drafts.id }).from(drafts).where(and(eq(drafts.campaign_id, id), or(
      eq(drafts.status, "publishing"), eq(drafts.status, "publish_failed"),
      sql`${drafts.scheduled_at} is not null`,
      and(sql`${drafts.revision_token} is not null`, sql`${drafts.revision_started_at} > now() - interval '5 minutes'`),
    ))).limit(1);
    if (blocked) throw new AppError("conflict", "Clear schedules and finish revisions or reconcile publication attempts before rerunning.");
    const [row] = await tx.update(campaigns).set({ status: "queued", run_id: null, started_at: new Date().toISOString(), finished_at: null,
      plan: null, goal: null, summary: null, brand_snapshot: null, llm_calls: 0 }).where(eq(campaigns.id, id)).returning();
    return row ?? null;
  });
}

export async function requeueFailedCampaign(id: string): Promise<Campaign | null> {
  return requeueCampaign(id, true);
}
