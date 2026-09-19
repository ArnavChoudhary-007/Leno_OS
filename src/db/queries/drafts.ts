import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts } from "@/db/schema";
import type { Critique, DraftStatus, PlatformId } from "@/shared/types";

export type DraftRow = typeof drafts.$inferSelect;

export type NewDraft = {
  campaign_id: string;
  platform: PlatformId;
  version: number;
  body: string;
  review_note?: string | null;
};

export async function insertDrafts(rows: NewDraft[]): Promise<DraftRow[]> {
  if (rows.length === 0) return [];
  return db.insert(drafts).values(rows).returning();
}

export async function getDraft(id: string): Promise<DraftRow | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(eq(drafts.id, id))
    .limit(1);
  return row ?? null;
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
      critic_notes: [...critique.gate_failures, ...critique.fix_list],
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

export async function saveReviewNote(
  id: string,
  note: string,
): Promise<void> {
  await db.update(drafts).set({ review_note: note }).where(eq(drafts.id, id));
}

/** Retires every version of a platform's post except the one being kept. */
export async function supersedeOtherVersions(
  campaignId: string,
  platform: PlatformId,
  keepDraftId: string,
): Promise<void> {
  await db
    .update(drafts)
    .set({ status: "superseded" })
    .where(
      and(
        eq(drafts.campaign_id, campaignId),
        eq(drafts.platform, platform),
        ne(drafts.id, keepDraftId),
      ),
    );
}

export async function supersedeDrafts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(drafts)
    .set({ status: "superseded" })
    .where(inArray(drafts.id, ids));
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

export async function getDraftsForPlatform(
  campaignId: string,
  platform: PlatformId,
): Promise<DraftRow[]> {
  return db
    .select()
    .from(drafts)
    .where(
      and(eq(drafts.campaign_id, campaignId), eq(drafts.platform, platform)),
    )
    .orderBy(desc(drafts.version));
}

/**
 * The live post for each platform: the one version that hasn't been
 * superseded. This is what a human reviews and what publishing would use.
 */
export async function getCurrentDraftsByPlatform(
  campaignId: string,
): Promise<DraftRow[]> {
  return db
    .selectDistinctOn([drafts.platform])
    .from(drafts)
    .where(
      and(
        eq(drafts.campaign_id, campaignId),
        ne(drafts.status, "superseded"),
      ),
    )
    .orderBy(drafts.platform, desc(drafts.version));
}

export async function getCurrentDraftForPlatform(
  campaignId: string,
  platform: PlatformId,
): Promise<DraftRow | null> {
  const [row] = await db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.campaign_id, campaignId),
        eq(drafts.platform, platform),
        ne(drafts.status, "superseded"),
      ),
    )
    .orderBy(desc(drafts.version))
    .limit(1);
  return row ?? null;
}
