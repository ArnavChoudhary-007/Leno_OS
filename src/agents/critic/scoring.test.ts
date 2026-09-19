import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hardGates,
  PASS_THRESHOLD,
  RUBRIC_WEIGHTS,
  weightedScore,
} from "./index";
import type { Draft } from "@/shared/types";

describe("weightedScore", () => {
  it("weights sum to 1", () => {
    const sum =
      RUBRIC_WEIGHTS.brand_voice +
      RUBRIC_WEIGHTS.goal_fit +
      RUBRIC_WEIGHTS.craft +
      RUBRIC_WEIGHTS.platform_fit;
    assert.equal(sum, 1);
  });

  it("returns 1 for perfect scores", () => {
    assert.equal(
      weightedScore({
        brand_voice: 1,
        goal_fit: 1,
        craft: 1,
        platform_fit: 1,
      }),
      1,
    );
  });

  it("returns 0 for zero scores", () => {
    assert.equal(
      weightedScore({
        brand_voice: 0,
        goal_fit: 0,
        craft: 0,
        platform_fit: 0,
      }),
      0,
    );
  });

  it("applies rubric weights", () => {
    // Only brand_voice = 1 → 0.3
    assert.equal(
      weightedScore({
        brand_voice: 1,
        goal_fit: 0,
        craft: 0,
        platform_fit: 0,
      }),
      0.3,
    );
  });

  it("pass threshold is 0.8", () => {
    assert.equal(PASS_THRESHOLD, 0.8);
  });
});

describe("hardGates", () => {
  const base: Draft = {
    platform: "x",
    body: "A tight hook about the product.",
    hashtags: ["#audio"],
  };

  it("passes a short on-brand X post", () => {
    assert.deepEqual(hardGates(base), []);
  });

  it("flags over-length posts", () => {
    const draft: Draft = {
      ...base,
      body: "x".repeat(300),
      hashtags: [],
    };
    const failures = hardGates(draft);
    assert.ok(failures.some((f) => f.includes("characters")));
  });

  it("flags banned terms", () => {
    const draft: Draft = {
      ...base,
      body: "Our miracle case is risk-free.",
    };
    const failures = hardGates(draft);
    assert.ok(failures.some((f) => f.includes("miracle")));
    assert.ok(failures.some((f) => f.includes("risk-free")));
  });

  it("flags LinkedIn specialist violations", () => {
    const draft: Draft = {
      platform: "linkedin",
      body: "We are thrilled to announce a seamless launch. Thoughts?",
      hashtags: [],
    };
    const failures = hardGates(draft);
    assert.ok(failures.some((f) => f.toLowerCase().includes("thrilled")));
    assert.ok(failures.some((f) => f.toLowerCase().includes("inflated") || f.toLowerCase().includes("seamless")));
  });
});
