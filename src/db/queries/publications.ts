import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { drafts, publications } from "@/db/schema";
import { lockDraft, type DraftRow } from "./drafts";
import { AppError } from "@/shared/errors";
import { composePost, validateDraft } from "@/agents/platforms";
import { supportsPublishing } from "@/lib/draft-state";
import type { PlatformId } from "@/shared/types";

export async function claimPublication(draftId: string, expectedSchedule?: string) {
  return db.transaction(async (tx) => {
    const draft = await lockDraft(tx, draftId);
    if (draft.status === "published" && draft.published_url) return { draft, attempt: null };
    if (draft.status !== "approved" || draft.revision_token) throw new AppError("conflict", "Only an approved, unlocked draft can publish. An earlier attempt may need reconciliation.");
    if (!supportsPublishing(draft.platform)) throw new AppError("not_publishable", "This platform is export-only.");
    const platform = draft.platform as PlatformId;
    const validation = validateDraft(platform, composePost({ platform, body: draft.body, hashtags: draft.hashtags }), draft.hashtags);
    if (!validation.valid) throw new AppError("not_publishable", validation.errors.join("; "));
    if (expectedSchedule && (draft.scheduled_at !== expectedSchedule || new Date(expectedSchedule).getTime() > Date.now())) throw new AppError("conflict", "The schedule was changed or cancelled.");
    const [attempt] = await tx.insert(publications).values({ draft_id: draftId, workspace_id: draft.workspace_id, provider: draft.platform === "linkedin" ? "linkedin" : "bluesky" }).returning();
    const [claimed] = await tx.update(drafts).set({ status: "publishing", publish_error: null }).where(eq(drafts.id, draftId)).returning();
    return { draft: claimed, attempt };
  });
}

export async function completePublication(draftId: string, attemptId: string, url: string): Promise<DraftRow> {
  return db.transaction(async (tx) => {
    const draft = await lockDraft(tx, draftId);
    if (draft.status !== "publishing") throw new AppError("conflict", "Publication needs reconciliation.");
    const [attempt] = await tx.update(publications).set({ status: "succeeded", external_url: url, updated_at: new Date().toISOString() })
      .where(and(eq(publications.id, attemptId), eq(publications.draft_id, draftId), eq(publications.status, "claimed"))).returning();
    if (!attempt) throw new AppError("conflict", "Publication needs reconciliation.");
    const [row] = await tx.update(drafts).set({ status: "published", published_url: url, published_at: new Date().toISOString(), scheduled_at: null, publish_error: null })
      .where(eq(drafts.id, draftId)).returning();
    return row;
  });
}

export async function failPublication(draftId: string, attemptId: string, externalUrl?: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockDraft(tx, draftId);
    const message = "The provider outcome is uncertain. Check the connected account and reconcile this attempt before retrying.";
    const [attempt] = await tx.update(publications).set({ status: "unknown", error: message, external_url: externalUrl ?? null, updated_at: new Date().toISOString() })
      .where(and(eq(publications.id, attemptId), eq(publications.status, "claimed"))).returning();
    if (attempt) await tx.update(drafts).set({ status: "publish_failed", publish_error: message, scheduled_at: null }).where(eq(drafts.id, draftId));
  });
}

export async function reconcilePublication(workspaceId: string, draftId: string, outcome: "published" | "not_published", url?: string): Promise<DraftRow> {
  return db.transaction(async (tx) => {
    const draft = await lockDraft(tx, draftId, workspaceId);
    if (draft.status !== "publish_failed") throw new AppError("conflict", "Only a failed or uncertain publication can be reconciled.");
    if (outcome === "published" && !url) throw new AppError("invalid_body", "Provide the actual published post URL.");
    await tx.update(publications).set({ status: outcome === "published" ? "succeeded" : "failed", external_url: url ?? null,
      error: "Manually reconciled by a workspace administrator.", updated_at: new Date().toISOString() })
      .where(and(eq(publications.draft_id, draftId), inArray(publications.status, ["unknown", "claimed"])));
    const [row] = await tx.update(drafts).set({ status: outcome === "published" ? "published" : "approved", published_url: url ?? null,
      published_at: outcome === "published" ? new Date().toISOString() : null, scheduled_at: null, publish_error: null, schedule_attempts: 0 })
      .where(eq(drafts.id, draftId)).returning();
    return row;
  });
}

export async function recoverAbandonedPublications(): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const abandoned = await db.select().from(publications).where(and(eq(publications.status, "claimed"), lt(publications.created_at, cutoff))).limit(20);
  for (const attempt of abandoned) await failPublication(attempt.draft_id, attempt.id);
}

export async function deferScheduledDraft(draftId: string, expectedSchedule: string, message: string): Promise<void> {
  await db.update(drafts).set({
    schedule_attempts: sql`${drafts.schedule_attempts} + 1`,
    status: sql`case when ${drafts.schedule_attempts} >= 4 then 'publish_failed' else 'approved' end`,
    scheduled_at: sql`case when ${drafts.schedule_attempts} >= 4 then null else now() + interval '1 minute' * power(2, ${drafts.schedule_attempts}) end`,
    publish_error: message,
  }).where(and(eq(drafts.id, draftId), eq(drafts.status, "approved"), eq(drafts.scheduled_at, expectedSchedule)));
}
