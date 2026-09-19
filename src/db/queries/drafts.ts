import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts } from "@/db/schema";
import type {
  Critique,
  DraftStatus,
  PlatformId,
} from "@/shared/types";

export type DraftRow = typeof drafts.$inferSelect;

export type NewDraft = {
  workspace_id: string;
  campaign_id: string;
  platform: PlatformId;
  version: number;
  body: string;
  hashtags: string[];
};

export async function insertDrafts(rows: NewDraft[]): Promise<DraftRow[]> {
  if (rows.length === 0) return [];
  return db.insert(drafts).values(rows).returning();
}

/** Stores the critic's verdict against one draft version. */
export async function updateDraftCritique(
  id: string,
  critique: Critique,
  status: DraftStatus,
): Promise<void> {
  await db
    .update(drafts)
    .set({
      score: critique.weighted,
      scores: critique.scores,
      critic_notes: {
        fix_list: critique.fix_list,
        gate_failures: critique.gate_failures,
        rationale: critique.rationale,
      },
      status,
    })
    .where(eq(drafts.id, id));
}

export async function updateDraftStatus(
  id: string,
  status: DraftStatus,
): Promise<void> {
  await db.update(drafts).set({ status }).where(eq(drafts.id, id));
}

export async function getDraft(id: string): Promise<DraftRow | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(eq(drafts.id, id))
    .limit(1);
  return row ?? null;
}

export async function getDraftInWorkspace(
  workspaceId: string,
  id: string,
): Promise<DraftRow | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, id), eq(drafts.workspace_id, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function approveDraft(id: string): Promise<DraftRow | null> {
  const [row] = await db
    .update(drafts)
    .set({ status: "approved", review_note: null })
    .where(eq(drafts.id, id))
    .returning();
  return row ?? null;
}

export async function rejectDraft(
  id: string,
  review_note: string,
): Promise<DraftRow | null> {
  const [row] = await db
    .update(drafts)
    .set({ status: "rejected", review_note })
    .where(eq(drafts.id, id))
    .returning();
  return row ?? null;
}

export async function editDraft(
  id: string,
  body: string,
  hashtags: string[],
): Promise<DraftRow | null> {
  const [row] = await db
    .update(drafts)
    .set({ body, hashtags, status: "draft", review_note: null })
    .where(eq(drafts.id, id))
    .returning();
  return row ?? null;
}

export async function scheduleDraft(
  id: string,
  scheduled_at: string,
): Promise<DraftRow | null> {
  const [row] = await db
    .update(drafts)
    .set({ scheduled_at, status: "approved" })
    .where(eq(drafts.id, id))
    .returning();
  return row ?? null;
}

export async function clearDraftSchedule(id: string): Promise<DraftRow | null> {
  const [row] = await db
    .update(drafts)
    .set({ scheduled_at: null })
    .where(eq(drafts.id, id))
    .returning();
  return row ?? null;
}

export async function markDraftPublished(
  id: string,
  published_url: string,
): Promise<DraftRow | null> {
  const [row] = await db
    .update(drafts)
    .set({
      status: "published",
      published_url,
      scheduled_at: null,
    })
    .where(eq(drafts.id, id))
    .returning();
  return row ?? null;
}

export async function getDraftsForCampaign(
  campaignId: string,
): Promise<DraftRow[]> {
  return db
    .select()
    .from(drafts)
    .where(eq(drafts.campaign_id, campaignId))
    .orderBy(drafts.platform, desc(drafts.version));
}

/** Newest revision of each platform's post — what a human would review. */
export async function getLatestDraftsByPlatform(
  campaignId: string,
): Promise<DraftRow[]> {
  return db
    .selectDistinctOn([drafts.platform])
    .from(drafts)
    .where(eq(drafts.campaign_id, campaignId))
    .orderBy(drafts.platform, desc(drafts.version));
}
