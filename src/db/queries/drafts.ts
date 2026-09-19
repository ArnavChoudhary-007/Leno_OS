import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns, drafts } from "@/db/schema";
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
  image_url?: string | null;
};

export async function insertDrafts(rows: NewDraft[]): Promise<DraftRow[]> {
  if (rows.length === 0) return [];
  return db
    .insert(drafts)
    .values(
      rows.map((row) => ({
        ...row,
        image_url: row.image_url ?? null,
      })),
    )
    .returning();
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

export async function workspaceDraftStats(workspaceId: string): Promise<{
  published: number;
  review: number;
  scheduled: number;
  total: number;
}> {
  const rows = await db
    .select({
      status: drafts.status,
      scheduled_at: drafts.scheduled_at,
    })
    .from(drafts)
    .where(eq(drafts.workspace_id, workspaceId));

  let published = 0;
  let review = 0;
  let scheduled = 0;
  for (const row of rows) {
    if (row.status === "published") published += 1;
    if (row.status === "needs_human" || row.status === "draft") review += 1;
    if (row.scheduled_at) scheduled += 1;
  }
  return { published, review, scheduled, total: rows.length };
}

export async function listScheduledDraftsInWorkspace(
  workspaceId: string,
  limit = 6,
): Promise<DraftRow[]> {
  return db
    .select()
    .from(drafts)
    .where(
      and(
        eq(drafts.workspace_id, workspaceId),
        isNotNull(drafts.scheduled_at),
      ),
    )
    .orderBy(drafts.scheduled_at)
    .limit(limit);
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

export type WorkspaceDraft = DraftRow & {
  campaign_brief: string;
  campaign_goal: string | null;
};

export type DraftActivity = {
  created_at: string;
  platform: string;
  status: DraftStatus;
  scheduled_at: string | null;
};

/** Newest revision per campaign + platform in the workspace. */
export async function listWorkspaceLatestDrafts(
  workspaceId: string,
  limit = 200,
): Promise<WorkspaceDraft[]> {
  const rows = await db
    .select({
      draft: drafts,
      campaign_brief: campaigns.brief,
      campaign_goal: campaigns.goal,
    })
    .from(drafts)
    .innerJoin(campaigns, eq(drafts.campaign_id, campaigns.id))
    .where(eq(drafts.workspace_id, workspaceId))
    .orderBy(desc(drafts.version), desc(drafts.created_at));

  const seen = new Set<string>();
  const latest: WorkspaceDraft[] = [];
  for (const row of rows) {
    const key = `${row.draft.campaign_id}:${row.draft.platform}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push({
      ...row.draft,
      campaign_brief: row.campaign_brief,
      campaign_goal: row.campaign_goal,
    });
    if (latest.length >= limit) break;
  }
  return latest;
}

export async function listDraftActivity(
  workspaceId: string,
): Promise<DraftActivity[]> {
  return db
    .select({
      created_at: drafts.created_at,
      platform: drafts.platform,
      status: drafts.status,
      scheduled_at: drafts.scheduled_at,
    })
    .from(drafts)
    .where(eq(drafts.workspace_id, workspaceId));
}

export async function deleteDraft(id: string): Promise<void> {
  await db.delete(drafts).where(eq(drafts.id, id));
}
