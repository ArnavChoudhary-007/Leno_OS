import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { requestedPlatforms, withRequestedPlatforms } from "./plan";

describe("requested platforms travel with the brief", () => {
  it("round-trips the picked platforms", () => {
    const brief = withRequestedPlatforms("Launch the new headphones to runners", ["linkedin", "x"]);
    assert.match(brief, /Platforms: linkedin, x$/);
    assert.deepEqual(requestedPlatforms(brief), ["linkedin", "x"]);
  });

  it("returns null when nothing was pinned", () => {
    assert.equal(requestedPlatforms("Launch the new headphones to runners"), null);
    assert.equal(withRequestedPlatforms("Launch it", undefined), "Launch it");
  });

  it("replaces an existing line instead of stacking a second one", () => {
    const once = withRequestedPlatforms("Launch it", ["x"]);
    const twice = withRequestedPlatforms(once, ["threads", "threads"]);
    assert.equal(twice.match(/Platforms:/g)?.length, 1);
    assert.deepEqual(requestedPlatforms(twice), ["threads"]);
  });

  it("ignores a line naming unknown platforms", () => {
    assert.equal(requestedPlatforms("Hi\n\nPlatforms: myspace, linkedin"), null);
  });
});
