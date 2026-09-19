import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blueskyPostUrl } from "./bluesky-url";

describe("blueskyPostUrl", () => {
  it("builds a public bsky.app URL from an at:// URI", () => {
    const url = blueskyPostUrl(
      "at://did:plc:abc123/app.bsky.feed.post/3k2example",
      "loopwave.bsky.social",
    );
    assert.equal(
      url,
      "https://bsky.app/profile/loopwave.bsky.social/post/3k2example",
    );
  });

  it("strips a leading @ from the handle", () => {
    const url = blueskyPostUrl(
      "at://did:plc:abc123/app.bsky.feed.post/rkey1",
      "@demo.bsky.social",
    );
    assert.equal(url, "https://bsky.app/profile/demo.bsky.social/post/rkey1");
  });
});
