import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { hardGates } from "@/agents/critic";
import { playbookBlock } from "@/agents/prompt";
import { PlanSchema } from "@/shared/schemas";
import type { Draft, Plan } from "@/shared/types";
import { composeDraftExport, composePost, PLATFORM_PLAYBOOKS } from ".";
import { applyInstagramAgent } from "./instagram-rules";

const plan: Plan = {
  goal: "Help teams organize their publishing calendar",
  audience: "Small teams",
  key_message: "Give the calendar one owner",
  platforms: ["instagram"],
  instagram_format: "carousel",
};
const carousel: Draft = {
  platform: "instagram",
  body: [
    "Give your calendar one owner.",
    "Slide 1: Why is every deadline a surprise?",
    "Slide 2: Pick one owner per campaign.",
    "Slide 3: Batch drafts on Monday.",
    "Slide 4: Review the schedule on Friday.",
    "Slide 5: Save this for your next planning session.",
  ].join("\n"),
  hashtags: ["#Planning"],
};

describe("Instagram specialist integration", () => {
  it("separates the caption from creative exports without dropping the script", () => {
    assert.equal(composePost(carousel), "Give your calendar one owner.\n\n#Planning");
    const exported = composeDraftExport(carousel);
    assert.match(exported, /Slide 1: Why/);
    assert.match(exported, /Slide 5: Save this/);
    assert.ok(exported.endsWith("#Planning"));
    const stories: Draft = { ...carousel, body: "Story 1: A question.\nStory 2: Add a poll sticker." };
    assert.doesNotMatch(composePost(stories), /Story 1/);
    assert.match(composeDraftExport(stories), /Story 2: Add a poll sticker/);
  });

  it("uses the specialist limit and leaves unrelated platforms unchanged", () => {
    assert.equal(PLATFORM_PLAYBOOKS.instagram.maxHashtags, 5);
    const other: Draft = { platform: "x", body: "Slide 1: These are literal words.", hashtags: [] };
    assert.equal(composePost(other), other.body);
    assert.equal(composeDraftExport(other), other.body);
  });

  it("includes Instagram instructions independently of LinkedIn", () => {
    assert.match(playbookBlock(["instagram"]), /=== INSTAGRAM SPECIALIST ===/);
    assert.doesNotMatch(playbookBlock(["instagram"]), /=== LINKEDIN SPECIALIST ===/);
    assert.doesNotMatch(playbookBlock(["x"]), /=== INSTAGRAM SPECIALIST ===/);
    const combined = playbookBlock(["instagram", "linkedin"]);
    assert.match(combined, /=== INSTAGRAM SPECIALIST ===/);
    assert.match(combined, /=== LINKEDIN SPECIALIST ===/);
  });

  it("keeps historical plans compatible and validates new format values", () => {
    const { instagram_format: _format, ...historical } = plan;
    assert.equal(PlanSchema.parse(historical).instagram_format, undefined);
    assert.equal(PlanSchema.parse(plan).instagram_format, "carousel");
    assert.equal(PlanSchema.safeParse({ ...plan, instagram_format: "reel" }).success, false);
  });

  it("runs Instagram gates through the shared critic without modifying scores", () => {
    assert.deepEqual(hardGates(applyInstagramAgent(carousel), plan), []);
    const missing = hardGates({ ...carousel, body: "Just a caption." }, plan);
    assert.ok(missing.some((failure) => failure.includes("Carousel requested")));
    const hook = hardGates({ ...carousel, body: "a".repeat(126) });
    assert.ok(hook.some((failure) => failure.includes("hook is")));
  });

  it("checks banned claims on slides and story frames, not just the caption", () => {
    for (const marker of ["Slide 2", "Story 2"]) {
      const failures = hardGates({ ...carousel, body: `A short hook.\n${marker}: A risk-free shortcut.` });
      assert.ok(failures.some((failure) => failure.includes('banned term "risk-free"')));
    }
  });

  it("counts hashtags toward the caption limit but not slide instructions", () => {
    const failures = hardGates({ ...carousel, body: `Hook.\n${"a".repeat(2193)}` });
    assert.ok(failures.some((failure) => failure.includes("characters")));
    const slideOnly = hardGates({ ...carousel, body: `Hook.\nSlide 1: ${"word ".repeat(500)}` });
    assert.ok(slideOnly.some((failure) => failure.includes("words")));
    assert.ok(!slideOnly.some((failure) => failure.includes("characters")));
  });

  it("applies sanitization after both writer entrypoints and carries the requested format", async () => {
    const source = await readFile(new URL("./draft.ts", import.meta.url), "utf8");
    assert.equal((source.match(/\.map\(applyInstagramAgent\)/g) ?? []).length, 2);
    assert.match(source, /INSTAGRAM FORMAT:/);
    assert.match(source, /plan\.instagram_format/);
    const revision = await readFile(new URL("../orchestrator/revise-with-note.ts", import.meta.url), "utf8");
    assert.match(revision, /await reviseDrafts\(/);
  });
});
