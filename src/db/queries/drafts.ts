import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { campaigns, drafts, publications } from "@/db/schema";
import { composePost, validateDraft } from "@/agents/platforms";
import { assertFutureSchedule, assertReviewable, assertRevisable, revisionIsActive } from "@/lib/draft-state";
import { AppError } from "@/shared/errors";
import type { Critique, DraftReview, DraftStatus, PlatformId } from "@/shared/types";

export type DraftRow = typeof drafts.$inferSelect;
export type DraftTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type NewDraft = {
  workspace_id: string;
  campaign_id: string;
  platform: PlatformId;
  version?: number;
  run_id?: string | null;
  body: string;
  hashtags: string[];
  image_url?: string | null;
  review_note?: string | null;
};

export async function lockDraft(tx: DraftTransaction, id: string, workspaceId?: string): Promise<DraftRow> {
  const [reference] = await tx.select().from(drafts).where(and(eq(drafts.id, id), workspaceId ? eq(drafts.workspace_id, workspaceId) : undefined)).limit(1);
  if (!reference) throw new AppError("not_found", "Draft not found");
  const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, reference.campaign_id)).for("update");
  if (!campaign) throw new AppError("not_found", "Campaign not found");
  if (campaign.status === "queued" || campaign.status === "running") throw new AppError("conflict", "Wait for the campaign run to finish before reviewing its drafts.");
  const [row] = await tx.select().from(drafts).where(eq(drafts.id, id)).for("update");
  if (!row) throw new AppError("not_found", "Draft not found");
  if (row.revision_token && !revisionIsActive(row)) {
    await tx.update(drafts).set({ revision_token: null, revision_started_at: null }).where(eq(drafts.id, id));
    return { ...row, revision_token: null, revision_started_at: null };
  }
  return row;
}

async function insertVersion(tx: DraftTransaction, input: NewDraft): Promise<DraftRow> {
  const [latest] = await tx.select({ version: drafts.version }).from(drafts)
    .where(and(eq(drafts.campaign_id, input.campaign_id), eq(drafts.platform, input.platform)))
    .orderBy(desc(drafts.version)).limit(1);
  const [row] = await tx.insert(drafts).values({ ...input, version: (latest?.version ?? 0) + 1 }).returning();
  return row;
}

export async function insertDrafts(rows: NewDraft[]): Promise<DraftRow[]> {
  if (!rows.length) return [];
  return db.transaction(async (tx) => {
    const campaignIds = [...new Set(rows.map((row) => row.campaign_id))].sort();
    for (const campaignId of campaignIds) {
      const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, campaignId)).for("update");
      if (!campaign) throw new AppError("not_found", "Campaign not found");
      if (rows.some((row) => row.campaign_id === campaignId && row.run_id && (row.run_id !== campaign.run_id || campaign.status !== "running"))) throw new AppError("conflict", "This run was replaced.");
    }
    const inserted: DraftRow[] = [];
    for (const input of rows) inserted.push(await insertVersion(tx, input));
    return inserted;
  });
}

export async function getDraft(id: string): Promise<DraftRow | null> {
  const [row] = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
  return row ?? null;
}

export async function getDraftInWorkspace(workspaceId: string, id: string): Promise<DraftRow | null> {
  const [row] = await db.select().from(drafts).where(and(eq(drafts.id, id), eq(drafts.workspace_id, workspaceId))).limit(1);
  return row ?? null;
}

export async function updateDraftCritique(id: string, critique: Critique, status: DraftStatus): Promise<void> {
  await db.update(drafts).set({ score: critique.weighted, scores: critique.scores, critic_notes: {
    fix_list: critique.fix_list, gate_failures: critique.gate_failures, rationale: critique.rationale,
  }, status }).where(and(eq(drafts.id, id), inArray(drafts.status, ["draft", "needs_human"])));
}

async function supersedeVersions(tx: DraftTransaction, campaignId: string, platform: string, keepId: string): Promise<void> {
  await tx.update(drafts).set({ status: "superseded", scheduled_at: null }).where(and(
    eq(drafts.campaign_id, campaignId), eq(drafts.platform, platform), ne(drafts.id, keepId),
    inArray(drafts.status, ["draft", "needs_human", "rejected"]), isNull(drafts.scheduled_at), isNull(drafts.revision_token),
  ));
}

export async function settleRunDrafts(campaignId: string, runId: string, choices: { id: string; status: "draft" | "needs_human" }[]): Promise<void> {
  await db.transaction(async (tx) => {
    const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, campaignId)).for("update");
    if (!campaign || campaign.run_id !== runId || campaign.status !== "running") throw new AppError("conflict", "This run is no longer active.");
    for (const choice of choices) {
      const [row] = await tx.update(drafts).set({ status: choice.status }).where(and(eq(drafts.id, choice.id), eq(drafts.run_id, runId), inArray(drafts.status, ["draft", "needs_human"]))).returning();
      if (row) await supersedeVersions(tx, campaignId, row.platform, row.id);
    }
  });
}

type LocalReview = Exclude<DraftReview, { action: "publish" | "resolve_publication" }>;

export async function applyDraftReview(workspaceId: string, id: string, action: LocalReview): Promise<DraftRow | null> {
  if (action.action === "schedule") assertFutureSchedule(action.scheduled_at);
  return db.transaction(async (tx) => {
    let existing = await lockDraft(tx, id, workspaceId);
    assertReviewable(existing);
    if (existing.revision_token) throw new AppError("conflict", "A revision is in progress. Try again when it finishes.");
    if (action.action === "delete") {
      const [attempt] = await tx.select({ id: publications.id }).from(publications).where(eq(publications.draft_id, id)).limit(1);
      if (attempt) throw new AppError("conflict", "Drafts with publication history cannot be deleted.");
      await tx.delete(drafts).where(eq(drafts.id, id));
      return null;
    }
    if (action.action === "edit" || action.action === "approve" || action.action === "schedule") {
      const body = action.body ?? existing.body;
      const hashtags = action.hashtags ?? existing.hashtags;
      if (action.action === "approve" || action.action === "schedule") {
        const platform = existing.platform as PlatformId;
        const validation = validateDraft(platform, composePost({ platform, body, hashtags }), hashtags);
        if (!validation.valid) throw new AppError("not_publishable", validation.errors.join("; "));
      }
      if (body !== existing.body || JSON.stringify(hashtags) !== JSON.stringify(existing.hashtags)) {
        const previous = existing;
        existing = await insertVersion(tx, { workspace_id: existing.workspace_id, campaign_id: existing.campaign_id,
          platform: existing.platform as PlatformId, body, hashtags, image_url: existing.image_url });
        await tx.update(drafts).set({ status: "superseded", scheduled_at: null }).where(eq(drafts.id, previous.id));
      }
    }
    const changes: Partial<typeof drafts.$inferInsert> = action.action === "reject"
      ? { status: "rejected", review_note: action.review_note, scheduled_at: null }
      : action.action === "edit"
        ? { status: "draft", scheduled_at: null, review_note: null, score: null, scores: null, critic_notes: null }
        : action.action === "clear_schedule"
          ? { scheduled_at: null, schedule_attempts: 0, publish_error: null }
          : { status: "approved", review_note: null, publish_error: null,
              ...(action.action === "schedule" ? { scheduled_at: action.scheduled_at, schedule_attempts: 0 } : {}) };
    const [row] = await tx.update(drafts).set(changes).where(eq(drafts.id, existing.id)).returning();
    return row;
  });
}

export async function claimDraftRevision(id: string): Promise<{ draft: DraftRow; token: string }> {
  return db.transaction(async (tx) => {
    const row = await lockDraft(tx, id);
    assertRevisable(row);
    if (row.revision_token && row.revision_started_at && Date.now() - new Date(row.revision_started_at).getTime() < 5 * 60_000) throw new AppError("conflict", "A revision is already running.");
    const token = crypto.randomUUID();
    await tx.update(drafts).set({ revision_token: token, revision_started_at: new Date().toISOString() }).where(eq(drafts.id, id));
    return { draft: row, token };
  });
}

export async function releaseDraftRevision(id: string, token: string): Promise<void> {
  await db.update(drafts).set({ revision_token: null, revision_started_at: null }).where(and(eq(drafts.id, id), eq(drafts.revision_token, token)));
}

export async function finishDraftRevision(id: string, token: string, input: NewDraft, critique: Critique, note: string): Promise<DraftRow> {
  return db.transaction(async (tx) => {
    const previous = await lockDraft(tx, id);
    assertRevisable(previous);
    if (previous.revision_token !== token) throw new AppError("conflict", "This revision was replaced.");
    const inserted = await insertVersion(tx, input);
    const [row] = await tx.update(drafts).set({ status: critique.pass ? "draft" : "needs_human", score: critique.weighted,
      scores: critique.scores, critic_notes: { fix_list: critique.fix_list, gate_failures: critique.gate_failures, rationale: critique.rationale } })
      .where(eq(drafts.id, inserted.id)).returning();
    await tx.update(drafts).set({ status: "superseded", review_note: note, revision_token: null, revision_started_at: null }).where(eq(drafts.id, id));
    await supersedeVersions(tx, row.campaign_id, row.platform, row.id);
    return row;
  });
}

export async function getDraftsForCampaign(campaignId: string, runId?: string): Promise<DraftRow[]> {
  return db.select().from(drafts).where(and(eq(drafts.campaign_id, campaignId), runId ? eq(drafts.run_id, runId) : undefined)).orderBy(drafts.platform, desc(drafts.version));
}

export async function getDraftsForPlatform(campaignId: string, platform: PlatformId): Promise<DraftRow[]> {
  return db.select().from(drafts).where(and(eq(drafts.campaign_id, campaignId), eq(drafts.platform, platform))).orderBy(desc(drafts.version));
}

export async function getCurrentDraftsByPlatform(campaignId: string): Promise<DraftRow[]> {
  return db.selectDistinctOn([drafts.platform]).from(drafts).where(and(eq(drafts.campaign_id, campaignId), ne(drafts.status, "superseded"))).orderBy(drafts.platform, desc(drafts.version));
}

export async function getCurrentDraftForPlatform(campaignId: string, platform: PlatformId): Promise<DraftRow | null> {
  const [row] = await db.select().from(drafts).where(and(eq(drafts.campaign_id, campaignId), eq(drafts.platform, platform), ne(drafts.status, "superseded"))).orderBy(desc(drafts.version)).limit(1);
  return row ?? null;
}

export type WorkspaceDraft = DraftRow & { campaign_brief: string; campaign_goal: string | null };

export async function listWorkspaceLatestDrafts(workspaceId: string, limit: number | null = 200): Promise<WorkspaceDraft[]> {
  const rows = await db.selectDistinctOn([drafts.campaign_id, drafts.platform])
    .from(drafts).innerJoin(campaigns, eq(drafts.campaign_id, campaigns.id))
    .where(and(eq(drafts.workspace_id, workspaceId), ne(drafts.status, "superseded")))
    .orderBy(drafts.campaign_id, drafts.platform, desc(drafts.version));
  const current = rows.map((row) => ({ ...row.drafts, campaign_brief: row.campaigns.brief, campaign_goal: row.campaigns.goal }))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  return limit === null ? current : current.slice(0, limit);
}

export type DraftActivity = Pick<DraftRow, "created_at" | "platform" | "status" | "scheduled_at">;

export async function listWorkspaceDraftAnalytics(workspaceId: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60_000).toISOString();
  return db.select({ created_at: drafts.created_at, published_at: drafts.published_at,
    platform: drafts.platform, status: drafts.status, title: campaigns.goal })
    .from(drafts).innerJoin(campaigns, eq(campaigns.id, drafts.campaign_id))
    .where(and(eq(drafts.workspace_id, workspaceId), or(gte(drafts.created_at, since), gte(drafts.published_at, since))));
}

export async function listDraftActivity(workspaceId: string): Promise<DraftActivity[]> {
  return db.select({ created_at: drafts.created_at, platform: drafts.platform, status: drafts.status, scheduled_at: drafts.scheduled_at })
    .from(drafts).where(and(eq(drafts.workspace_id, workspaceId), ne(drafts.status, "superseded")));
}

export async function workspaceDraftStats(workspaceId: string) {
  const rows = await listDraftActivity(workspaceId);
  return { total: rows.length, published: rows.filter((row) => row.status === "published").length,
    review: rows.filter((row) => row.status === "draft" || row.status === "needs_human" || row.status === "publish_failed").length,
    scheduled: rows.filter((row) => row.status === "approved" && row.scheduled_at).length };
}

export async function listScheduledDraftsInWorkspace(workspaceId: string, limit = 6): Promise<DraftRow[]> {
  return db.select().from(drafts).where(and(eq(drafts.workspace_id, workspaceId), eq(drafts.status, "approved"), isNotNull(drafts.scheduled_at)))
    .orderBy(drafts.scheduled_at).limit(limit);
}

export async function listDueDrafts(now = new Date()): Promise<DraftRow[]> {
  return db.select().from(drafts).where(and(eq(drafts.status, "approved"), lte(drafts.scheduled_at, now.toISOString())))
    .orderBy(drafts.scheduled_at).limit(20);
}
