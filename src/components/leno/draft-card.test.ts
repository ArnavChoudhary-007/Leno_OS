import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";
import { DraftCard, type DraftCardData } from "../../app/campaigns/[id]/draft-card";

const draft: DraftCardData = {
  id: "draft-1",
  campaign_id: "campaign-1",
  platform: "linkedin",
  version: 1,
  body: "A useful draft for human review.",
  hashtags: [],
  score: 0.9,
  critic_notes: null,
  status: "approved",
  review_note: null,
  scheduled_at: null,
  published_url: null,
  image_url: null,
  publish_error: null,
};

function render(overrides: Partial<DraftCardData> = {}, canMutate = true, isAdmin = false) {
  return renderToStaticMarkup(createElement(DraftCard, {
    draft: { ...draft, ...overrides },
    destinations: { linkedin: true, bluesky: true },
    canMutate,
    isAdmin,
    onChanged: () => undefined,
  }));
}

describe("draft card affordances", () => {
  it("keeps unsupported platforms export-only even when Bluesky is connected", () => {
    for (const platform of ["instagram", "threads", "facebook"]) {
      const html = render({ platform });
      assert.match(html, /Export only/);
      assert.match(html, />Copy</);
      assert.match(html, /Open PNG/);
      assert.doesNotMatch(html, /Publish to (LinkedIn|Bluesky)/);
      assert.doesNotMatch(html, /Connect .* to publish/);
      assert.match(html, /<button\b[^>]*disabled[^>]*>Schedule<\/button>/);
    }
  });

  it("names only supported destinations for live publishing", () => {
    assert.match(render(), /Publish to LinkedIn/);
    assert.match(render({ platform: "x" }), /Publish to Bluesky/);
  });

  it("hides mutation actions from viewers and immutable draft states", () => {
    const markup = [render({ status: "needs_human" }, false), render({}, false)];
    for (const status of ["published", "publishing", "publish_failed", "superseded"] as const) {
      markup.push(render({ status }));
    }
    for (const html of markup) {
      assert.doesNotMatch(html, />(Approve|Edit|Reject|Schedule|Request revision|Publish to LinkedIn)</);
      assert.match(html, />Copy</);
    }
  });

  it("shows publication errors but reserves reconciliation for admins", () => {
    const failure = { status: "publish_failed", publish_error: "Provider timed out" } as const;
    const editor = render(failure);
    assert.match(editor, /Provider timed out/);
    assert.match(editor, /Publication outcome is uncertain/);
    assert.doesNotMatch(editor, /Confirm not published/);
    const admin = render(failure, true, true);
    assert.match(admin, /Confirm published/);
    assert.match(admin, /Confirm not published/);
    assert.match(admin, /I checked the destination/);
    assert.doesNotMatch(admin, /Publish to LinkedIn/);
  });
});
