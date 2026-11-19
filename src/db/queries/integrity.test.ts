import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { client, db } from "@/db/client";
import { campaigns, drafts, publications, workspaces } from "@/db/schema";
import { claimCampaign, failInterruptedCampaign, finishCampaign, getCampaign, insertCampaign, requeueCampaign } from "./campaigns";
import { applyDraftReview, claimDraftRevision, getCurrentDraftForPlatform, getDraft, getDraftInWorkspace, insertDrafts, listWorkspaceDraftAnalytics } from "./drafts";
import { claimPublication, completePublication, failPublication, reconcilePublication } from "./publications";
import { acceptWorkspaceInvite, insertInvite } from "./workspaces";

describe("transactional workflow integrity", () => {
  let workspaceId: string;

  before(async () => {
    const [workspace] = await db.insert(workspaces).values({ name: "Integrity regression", slug: `test-integrity-${crypto.randomUUID()}` }).returning();
    workspaceId = workspace.id;
  });

  after(async () => {
    if (workspaceId) {
      await db.delete(publications).where(eq(publications.workspace_id, workspaceId));
      await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
    }
    await client.end();
  });

  async function reviewableDraft() {
    const campaign = await insertCampaign({ workspaceId, createdBy: "regression", brief: "Test a safe campaign with an explicitly approved post." });
    const runId = crypto.randomUUID();
    assert.equal(await claimCampaign(campaign.id, new Date(), runId), true);
    const [draft] = await insertDrafts([{ workspace_id: workspaceId, campaign_id: campaign.id, run_id: runId,
      platform: "x", body: "A short post for transactional regression checks.", hashtags: [] }]);
    await finishCampaign(campaign.id, "ready", null, runId);
    return { campaign, draft, runId };
  }

  it("gives exactly one caller an active run and fences stale recovery", async () => {
    const campaign = await insertCampaign({ workspaceId, createdBy: "regression", brief: "Concurrent callers must not start duplicate generation runs." });
    const claims = await Promise.all(Array.from({ length: 8 }, () => claimCampaign(campaign.id)));
    assert.equal(claims.filter(Boolean).length, 1);
    assert.equal(await failInterruptedCampaign(campaign), false);
    const active = await getCampaign(campaign.id);
    assert.equal(active?.status, "running");
    assert.ok(active?.run_id);
    await finishCampaign(campaign.id, "ready", null, active.run_id);
  });

  it("allocates unique versions under concurrent writes and excludes superseded winners", async () => {
    const { campaign, draft } = await reviewableDraft();
    const results = await Promise.all(Array.from({ length: 6 }, () => insertDrafts([{ workspace_id: workspaceId,
      campaign_id: campaign.id, platform: "x", body: "Another version", hashtags: [] }])));
    const versions = results.flat().map((row) => row.version);
    assert.equal(new Set(versions).size, 6);
    assert.deepEqual([...versions].sort((left, right) => left - right), [2, 3, 4, 5, 6, 7]);
    for (const row of results.flat()) await db.update(drafts).set({ status: "superseded" }).where(eq(drafts.id, row.id));
    assert.equal((await getCurrentDraftForPlatform(campaign.id, "x"))?.id, draft.id);
  });

  it("saves edited approval atomically and rejects invalid schedules without changing approval", async () => {
    const { draft } = await reviewableDraft();
    const edited = await applyDraftReview(workspaceId, draft.id, { action: "approve", body: "Human edited copy", hashtags: [] });
    assert.ok(edited);
    assert.equal(edited.body, "Human edited copy");
    assert.equal(edited.status, "approved");
    assert.equal(edited.version, 2);
    assert.equal((await getDraft(draft.id))?.status, "superseded");
    await assert.rejects(applyDraftReview(workspaceId, edited.id, { action: "schedule", scheduled_at: "invalid" }), { code: "invalid_body" });
    assert.equal((await getDraft(edited.id))?.scheduled_at, null);
    assert.equal((await getDraft(edited.id))?.status, "approved");
    await assert.rejects(applyDraftReview(workspaceId, edited.id, { action: "approve", body: "x".repeat(400) }), { code: "not_publishable" });
    assert.equal((await getDraft(edited.id))?.body, "Human edited copy");
  });

  it("enforces workspace scope for lookups and review transactions", async () => {
    const { draft } = await reviewableDraft();
    assert.equal(await getDraftInWorkspace("another-workspace", draft.id), null);
    await assert.rejects(applyDraftReview("another-workspace", draft.id, { action: "approve" }), { code: "not_found" });
    assert.equal((await getDraft(draft.id))?.status, "draft");
  });

  it("claims a publication once, locks uncertain outcomes and preserves published history", async () => {
    const { campaign, draft } = await reviewableDraft();
    await applyDraftReview(workspaceId, draft.id, { action: "approve" });
    const claims = await Promise.allSettled(Array.from({ length: 6 }, () => claimPublication(draft.id)));
    const won = claims.filter((result) => result.status === "fulfilled");
    assert.equal(won.length, 1);
    assert.ok(won[0].value.attempt);
    await assert.rejects(claimDraftRevision(draft.id), { code: "conflict" });
    await failPublication(draft.id, won[0].value.attempt.id);
    assert.equal((await getDraft(draft.id))?.status, "publish_failed");
    await assert.rejects(claimPublication(draft.id), { code: "conflict" });
    await assert.rejects(requeueCampaign(campaign.id), { code: "conflict" });
    await reconcilePublication(workspaceId, draft.id, "not_published");
    const retry = await claimPublication(draft.id);
    assert.ok(retry.attempt);
    const published = await completePublication(draft.id, retry.attempt.id, "https://bsky.app/profile/test/post/test");
    assert.ok(published.published_at);
    assert.equal((await claimPublication(draft.id)).attempt, null);
    await assert.rejects(claimDraftRevision(draft.id), { code: "conflict" });
    await assert.rejects(applyDraftReview(workspaceId, draft.id, { action: "delete" }), { code: "conflict" });
    await requeueCampaign(campaign.id);
    const nextRunId = crypto.randomUUID();
    await claimCampaign(campaign.id, new Date(), nextRunId);
    await insertDrafts([{ workspace_id: workspaceId, campaign_id: campaign.id, run_id: nextRunId, platform: "x", body: "Fresh run output", hashtags: [] }]);
    await finishCampaign(campaign.id, "ready", null, nextRunId);
    assert.ok((await listWorkspaceDraftAnalytics(workspaceId)).some((row) => row.status === "published" && row.published_at === published.published_at));
    assert.equal((await getDraft(draft.id))?.status, "published");
  });

  it("refuses a worker's stale schedule after cancellation", async () => {
    const { draft } = await reviewableDraft();
    await applyDraftReview(workspaceId, draft.id, { action: "schedule", scheduled_at: new Date(Date.now() + 60_000).toISOString() });
    const due = new Date(Date.now() - 1000).toISOString();
    const [scheduled] = await db.update(drafts).set({ scheduled_at: due }).where(eq(drafts.id, draft.id)).returning();
    assert.ok(scheduled.scheduled_at);
    await assert.rejects(claimDraftRevision(draft.id), { code: "conflict" });
    await applyDraftReview(workspaceId, draft.id, { action: "clear_schedule" });
    await assert.rejects(claimPublication(draft.id, scheduled.scheduled_at), { code: "conflict" });
    assert.equal((await getDraft(draft.id))?.status, "approved");
  });

  it("makes invitation acceptance email-bound and single-use", async () => {
    const tokenHash = crypto.randomUUID();
    await insertInvite({ workspaceId, email: "regression@example.com", role: "editor", tokenHash,
      invitedBy: "regression", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    await assert.rejects(acceptWorkspaceInvite(tokenHash, crypto.randomUUID(), null), { code: "forbidden" });
    const accepted = await Promise.allSettled(Array.from({ length: 3 }, () => acceptWorkspaceInvite(tokenHash, crypto.randomUUID(), "regression@example.com")));
    assert.equal(accepted.filter((result) => result.status === "fulfilled").length, 1);
  });

  it("does not let a superseded run finish or write new drafts", async () => {
    const { campaign, runId } = await reviewableDraft();
    await requeueCampaign(campaign.id);
    const nextRunId = crypto.randomUUID();
    await claimCampaign(campaign.id, new Date(), nextRunId);
    await finishCampaign(campaign.id, "failed", null, runId);
    assert.equal((await getCampaign(campaign.id))?.status, "running");
    await assert.rejects(insertDrafts([{ workspace_id: workspaceId, campaign_id: campaign.id, run_id: runId,
      platform: "x", body: "Late stale output", hashtags: [] }]), { code: "conflict" });
    await db.update(campaigns).set({ status: "ready" }).where(eq(campaigns.id, campaign.id));
  });
});
