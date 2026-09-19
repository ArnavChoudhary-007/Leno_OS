import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyLinkedInAgent,
  linkedinGateFailures,
  sanitizeLinkedInDraft,
} from "./linkedin-rules";
import type { Draft } from "@/shared/types";

const draft = (body: string, hashtags: string[] = []): Draft => ({
  platform: "linkedin",
  body,
  hashtags,
});

describe("sanitizeLinkedInDraft", () => {
  it("leaves non-LinkedIn drafts alone", () => {
    const x: Draft = { platform: "x", body: "Agree?", hashtags: [] };
    assert.equal(sanitizeLinkedInDraft(x), x);
  });

  it("replaces em dashes and strips bait CTAs", () => {
    const cleaned = sanitizeLinkedInDraft(
      draft("The case is live \u2014 shipping Friday. Thoughts?"),
    );
    assert.equal(/[\u2014\u2013]/.test(cleaned.body), false);
    assert.equal(cleaned.body.toLowerCase().includes("thoughts?"), false);
  });

  it("caps hashtags at 3", () => {
    const cleaned = sanitizeLinkedInDraft(
      draft("Aero Case Pro is out.", ["#a", "#b", "#c", "#d", "#e"]),
    );
    assert.deepEqual(cleaned.hashtags, ["#a", "#b", "#c"]);
  });
});

describe("linkedinGateFailures", () => {
  it("passes a direct, specific post", () => {
    assert.deepEqual(
      linkedinGateFailures(
        "Aero Case Pro is out. It adds 30 hours so the case in your pocket actually lasts a work week.",
      ),
      [],
    );
  });

  it("flags buzzwords, clickbait, and thrilled-to-announce openings", () => {
    const failures = linkedinGateFailures(
      "We are thrilled to announce a game-changing launch. Stop scrolling. Leverage this at scale.",
    );
    assert.ok(failures.some((f) => f.includes("thrilled")));
    assert.ok(failures.some((f) => f.includes("Stop scrolling") || f.includes("stop scrolling")));
    assert.ok(failures.some((f) => f.includes("inflated")));
  });
});

describe("applyLinkedInAgent", () => {
  it("is a no-op identity for already-clean LinkedIn copy", () => {
    const input = draft("Notetaker is live on Windows.");
    assert.deepEqual(applyLinkedInAgent(input), input);
  });
});
