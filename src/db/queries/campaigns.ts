import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import type { CampaignStatus, Plan } from "@/shared/types";

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

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
): Promise<void> {
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
}

/**
 * The planner produces one Plan; `goal` keeps the goal statement the run
 * was steered by and `plan` the whole thing, so a later edit to the plan
 * doesn't erase what the campaign originally set out to do.
 */
export async function saveCampaignPlan(id: string, plan: Plan): Promise<void> {
  await db.update(campaigns).set({ goal: plan, plan }).where(eq(campaigns.id, id));
}
