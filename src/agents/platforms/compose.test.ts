import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composePost, validateDraft } from "./index";
import { dedupeByPlatform } from "./draft";
import type { Draft } from "@/shared/types";

describe("composePost", () => {
  it("returns body alone when there are no hashtags", () => {
    assert.equal(
      composePost({ platform: "x", body: " Hello ", hashtags: [] }),
      "Hello",
    );
  });

  it("appends normalized hashtags", () => {
    assert.equal(
      composePost({
        platform: "instagram",
        body: "Caption",
        hashtags: ["audio", "#gear"],
      }),
      "Caption\n\n#audio #gear",
    );
  });
});

describe("validateDraft", () => {
  it("rejects disabled platforms", () => {
    const result = validateDraft("facebook", "hi", []);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0]?.includes("not enabled"));
  });

  it("rejects too many hashtags", () => {
    const result = validateDraft("x", "hi", ["#a", "#b", "#c", "#d"]);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("hashtags")));
  });
});

describe("dedupeByPlatform", () => {
  const draft = (platform: Draft["platform"], body: string): Draft => ({
    platform,
    body,
    hashtags: [],
  });

  it("keeps the first draft per platform in wanted order", () => {
    const result = dedupeByPlatform(
      [
        draft("linkedin", "second"),
        draft("x", "first-x"),
        draft("x", "dup-x"),
        draft("linkedin", "first-li"),
      ],
      ["x", "linkedin"],
    );
    assert.deepEqual(
      result.map((d) => `${d.platform}:${d.body}`),
      ["x:first-x", "linkedin:second"],
    );
  });

  it("throws when a requested platform is missing", () => {
    assert.throws(
      () => dedupeByPlatform([draft("x", "only")], ["x", "instagram"]),
      /Writer skipped platform\(s\): instagram/,
    );
  });
});
