import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import type { CampaignStatus, CampaignSummary, Plan } from "@/shared/types";

export type Campaign = typeof campaigns.$inferSelect;

/** How long a `running` campaign may sit before we treat it as abandoned. */
export const STALE_RUNNING_MS = 30 * 60 * 1000;

export async function insertCampaign(input: {
  workspaceId: string;
  createdBy: string;
  brief: string;
  brandId?: string | null;
}): Promise<Campaign> {
  const [row] = await db
    .insert(campaigns)
    .values({
      brief: input.brief,
      status: "queued",
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      brand_id: input.brandId ?? null,
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

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
): Promise<void> {
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
}

/**
 * The planner produces one Plan. `goal` stores the goal statement for
 * display/filter; `plan` stores the full object.
 */
export async function saveCampaignPlan(id: string, plan: Plan): Promise<void> {
  await db
    .update(campaigns)
    .set({ goal: plan.goal, plan })
    .where(eq(campaigns.id, id));
}

export async function saveBrandSnapshot(
  id: string,
  brandCard: string,
): Promise<void> {
  await db
    .update(campaigns)
    .set({ brand_snapshot: brandCard })
    .where(eq(campaigns.id, id));
}

/** Counted in the database so parallel work can't lose an increment. */
export async function countLlmCall(id: string): Promise<void> {
  await db
    .update(campaigns)
    .set({ llm_calls: sql`${campaigns.llm_calls} + 1` })
    .where(eq(campaigns.id, id));
}

export async function finishCampaign(
  id: string,
  status: CampaignStatus,
  summary: CampaignSummary | null,
): Promise<void> {
  await db
    .update(campaigns)
    .set({ status, summary, finished_at: new Date().toISOString() })
    .where(eq(campaigns.id, id));
}

/**
 * Takes ownership of a campaign in a single statement. Returns null if
 * someone else already owns it — this is what stops two runs of the same
 * campaign, so it must stay one atomic UPDATE.
 *
 * Claimable: a `queued` campaign, or a `running` one whose last claim is
 * older than STALE_RUNNING_MS (the process behind it almost certainly
 * died). The staleness clause is the backstop for a run that slipped past
 * `recoverStuckRuns`.
 */
export async function claimCampaign(
  id: string,
  now = new Date(),
): Promise<Campaign | null> {
  const staleBefore = new Date(now.getTime() - STALE_RUNNING_MS).toISOString();

  const [row] = await db
    .update(campaigns)
    .set({
      status: "running",
      started_at: now.toISOString(),
      finished_at: null,
    })
    .where(
      and(
        eq(campaigns.id, id),
        or(
          eq(campaigns.status, "queued"),
          and(
            eq(campaigns.status, "running"),
            or(
              isNull(campaigns.started_at),
              lt(campaigns.started_at, staleBefore),
            ),
          ),
        ),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Puts a finished or failed campaign back on the queue so it can be retried.
 * Refuses campaigns that are still actively running (not stale).
 */
export async function requeueCampaign(id: string): Promise<Campaign | null> {
  const campaign = await getCampaign(id);
  if (!campaign) return null;

  if (campaign.status === "running" && !isStaleRunning(campaign)) {
    throw new Error("Campaign is still running");
  }
  if (campaign.status === "queued") return campaign;

  const [row] = await db
    .update(campaigns)
    .set({ status: "queued", started_at: null, finished_at: null })
    .where(eq(campaigns.id, id))
    .returning();
  return row ?? null;
}

/** Only a failed campaign may be retried; returns null if it isn't one. */
export async function requeueFailedCampaign(
  id: string,
): Promise<Campaign | null> {
  const [row] = await db
    .update(campaigns)
    .set({ status: "queued", finished_at: null })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "failed")))
    .returning();
  return row ?? null;
}

export async function getRunningCampaigns(): Promise<Campaign[]> {
  return db.select().from(campaigns).where(eq(campaigns.status, "running"));
}

function isStaleRunning(campaign: Campaign, now = Date.now()): boolean {
  if (campaign.status !== "running") return false;
  if (!campaign.started_at) return true;
  return now - new Date(campaign.started_at).getTime() >= STALE_RUNNING_MS;
}
