import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import type { CampaignStatus, Plan } from "@/shared/types";

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
): Promise<boolean> {
  const campaign = await getCampaign(id);
  if (!campaign) {
    throw new Error(`Campaign ${id} not found`);
  }

  const mayClaim =
    campaign.status === "queued" || isStaleRunning(campaign, now.getTime());
  if (!mayClaim) return false;

  await db
    .update(campaigns)
    .set({
      status: "running",
      started_at: now.toISOString(),
    })
    .where(eq(campaigns.id, id));
  return true;
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
    .set({ status: "queued", started_at: null })
    .where(eq(campaigns.id, id))
    .returning();
  return row ?? null;
}
