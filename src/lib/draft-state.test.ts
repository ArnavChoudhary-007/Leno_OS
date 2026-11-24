import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertFutureSchedule, assertReviewable, assertRevisable, revisionIsActive, supportsPublishing } from "./draft-state";
import { CampaignCreateSchema, DraftReviewSchema, InviteCreateSchema } from "@/shared/schemas";

describe("draft state safety", () => {
  it("locks published, superseded, in-flight and uncertain drafts", () => {
    for (const status of ["published", "superseded", "publishing", "publish_failed"] as const) {
      assert.throws(() => assertReviewable({ status }), { code: "conflict" });
      assert.throws(() => assertRevisable({ status, scheduled_at: null }), { code: "conflict" });
    }
    for (const status of ["draft", "needs_human", "approved", "rejected"] as const) {
      assert.doesNotThrow(() => assertReviewable({ status }));
    }
  });

  it("requires cancelling schedules before revision", () => {
    assert.throws(() => assertRevisable({ status: "approved", scheduled_at: "2026-12-01T12:00:00Z" }), { code: "conflict" });
    assert.doesNotThrow(() => assertRevisable({ status: "approved", scheduled_at: null }));
  });

  it("rejects invalid, current and past scheduling timestamps", () => {
    const now = Date.parse("2026-11-18T12:00:00Z");
    for (const value of ["invalid", "2026-11-18T12:00:00Z", "2026-11-17T12:00:00Z"]) {
      assert.throws(() => assertFutureSchedule(value, now), { code: "invalid_body" });
    }
    assert.doesNotThrow(() => assertFutureSchedule("2026-11-18T12:00:01Z", now));
    assert.equal(DraftReviewSchema.safeParse({ action: "schedule", scheduled_at: "not-a-date" }).success, false);
  });

  it("allows recovery of expired or incomplete revision claims", () => {
    const now = Date.parse("2026-11-18T12:00:00Z");
    assert.equal(revisionIsActive({ revision_token: "token", revision_started_at: new Date(now - 1000).toISOString() }, now), true);
    for (const started of [null, "invalid", new Date(now - 5 * 60_000).toISOString()]) {
      assert.equal(revisionIsActive({ revision_token: "token", revision_started_at: started }, now), false);
    }
    assert.equal(revisionIsActive({ revision_token: null, revision_started_at: new Date(now).toISOString() }, now), false);
  });

  it("does not silently route export-only channels to Bluesky", () => {
    assert.equal(supportsPublishing("x"), true);
    assert.equal(supportsPublishing("linkedin"), true);
    for (const platform of ["instagram", "threads", "facebook", "unknown"]) assert.equal(supportsPublishing(platform), false);
  });
});

describe("structured campaign and invitation inputs", () => {
  const brief = "A complete campaign brief about reliable human-approved distribution.";

  it("preserves all campaign controls without flattening them into text", () => {
    const options = { platforms: ["x", "x"], creativity: 0.2, research: false, researchDepth: "deep", length: "short", brandVoice: false, source: "repurpose" };
    const parsed = CampaignCreateSchema.parse({ brief, options });
    assert.equal(parsed.brief, brief);
    assert.deepEqual(parsed.options, { ...options, platforms: ["x"] });
    assert.equal(CampaignCreateSchema.safeParse({ brief, options: { platforms: [] } }).success, false);
    assert.equal(CampaignCreateSchema.safeParse({ brief, options: { creativity: 1.1 } }).success, false);
    assert.equal(CampaignCreateSchema.safeParse({ brief, options: { research: "false" } }).success, false);
  });

  it("allows edited copy in a single approve or schedule action", () => {
    for (const action of ["approve", "schedule"]) {
      const parsed = DraftReviewSchema.parse({ action, body: "Edited before approval", hashtags: ["test"], scheduled_at: "2026-12-01T12:00:00Z" });
      assert.equal("body" in parsed && parsed.body, "Edited before approval");
    }
  });

  it("does not permit creating owner invitations or malformed emails", () => {
    assert.equal(InviteCreateSchema.safeParse({ email: "teammate@example.com", role: "admin" }).success, true);
    assert.equal(InviteCreateSchema.safeParse({ email: "teammate@example.com", role: "owner" }).success, false);
    assert.equal(InviteCreateSchema.safeParse({ email: "invalid", role: "editor" }).success, false);
  });
});
