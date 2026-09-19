import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import type { CampaignStatus, CampaignSummary, Plan } from "@/shared/types";

export type Campaign = typeof campaigns.$inferSelect;

export async function insertCampaign(brief: string): Promise<Campaign> {
  const [row] = await db
    .insert(campaigns)
    .values({ brief, status: "queued" })
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

/**
 * Takes ownership of a queued campaign in a single statement. Returns null
 * if someone else already claimed it — this is what stops two runs of the
 * same campaign, so it must stay one atomic UPDATE.
 */
export async function claimCampaign(id: string): Promise<Campaign | null> {
  const [row] = await db
    .update(campaigns)
    .set({
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
    })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "queued")))
    .returning();
  return row ?? null;
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
): Promise<void> {
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
}

export async function saveCampaignPlan(id: string, plan: Plan): Promise<void> {
  await db
    .update(campaigns)
    .set({ goal: plan, plan })
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
