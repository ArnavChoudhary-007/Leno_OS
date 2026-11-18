import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { bucketByDay, canApproveDraft, canEditDraft, draftStage, draftWindow, inDateWindow, isPlatformId, nativePublishDestination } from "../../lib/workspace-ui";

describe("draft UI safety", () => {
  it("starts a fresh editor session when opening or switching drafts", async () => {
    for (const path of ["../../app/campaigns/content-library.tsx", "../../app/campaigns/new/brief-form.tsx"]) {
      const source = await readFile(new URL(path, import.meta.url), "utf8");
      assert.match(source, /<EditorDrawer\s+key=\{editing\?\.id \?\? "closed"\}/);
    }
  });
  it("exposes publishing only for LinkedIn and X through Bluesky", () => {
    assert.equal(nativePublishDestination("linkedin"), "LinkedIn");
    assert.equal(nativePublishDestination("x"), "Bluesky");
    for (const platform of ["instagram", "threads", "facebook", "unknown"]) {
      assert.equal(nativePublishDestination(platform), null);
    }
  });

  it("makes published, publishing and uncertain drafts read-only", () => {
    for (const status of ["published", "publishing", "publish_failed", "superseded"]) {
      assert.equal(canEditDraft(status), false);
      assert.equal(canApproveDraft(status), false);
    }
    assert.equal(canApproveDraft("draft"), true);
    assert.equal(canEditDraft("approved"), true);
    assert.equal(canApproveDraft("approved"), false);
  });

  it("prioritizes publication state over stale schedules", () => {
    const common = { scheduled_at: "2026-11-17T12:00:00Z", score: 0.9 };
    assert.equal(draftStage({ ...common, status: "publishing" }), "Publishing");
    assert.equal(draftStage({ ...common, status: "publish_failed" }), "Publication failed");
    assert.equal(draftStage({ ...common, status: "rejected" }), "Review");
    assert.equal(draftStage({ ...common, status: "approved" }), "Scheduled");
  });

  it("does not treat inherited object properties as platform IDs", () => {
    assert.equal(isPlatformId("toString"), false);
    assert.equal(isPlatformId("linkedin"), true);
  });
});

describe("analytics date windows", () => {
  const now = new Date(2026, 10, 17, 12);
  const inside = new Date(2026, 10, 11, 0).toISOString();
  const outside = new Date(2026, 10, 10, 23, 59).toISOString();
  const today = new Date(2026, 10, 17, 10).toISOString();
  const future = new Date(2026, 10, 17, 13).toISOString();

  it("uses inclusive calendar-day starts and rejects invalid or future dates", () => {
    assert.equal(inDateWindow(inside, 7, now), true);
    for (const timestamp of [outside, future, "invalid", null]) {
      assert.equal(inDateWindow(timestamp, 7, now), false);
    }
  });

  it("distinguishes creation and actual publication dates without a row cap", () => {
    const rows: { created_at: string; published_at: string | null; status: string }[] =
      Array.from({ length: 250 }, () => ({ created_at: today, published_at: null, status: "draft" }));
    rows.push({ created_at: outside, published_at: today, status: "published" });
    rows.push({ created_at: today, published_at: today, status: "published" });
    rows.push({ created_at: today, published_at: null, status: "published" });
    const result = draftWindow(rows, 7, now);
    assert.equal(result.created.length, 252);
    assert.equal(result.published.length, 2);
    assert.equal(result.publishedFromCreated, 1);
  });

  it("keeps chart totals aligned with the same date window", () => {
    const timestamps = [inside, outside, today, future, "invalid"];
    const points = bucketByDay(timestamps, 7, now);
    assert.equal(points.length, 7);
    assert.equal(points.reduce((total, point) => total + point.val, 0), 2);
    assert.equal(points[0].val, 1);
    assert.equal(points[6].val, 1);
  });
});
