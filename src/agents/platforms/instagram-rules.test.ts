import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyInstagramAgent,
  countEmoji,
  instagramGateFailures,
  INSTAGRAM_HOOK_MAX_CHARS,
  INSTAGRAM_MAX_CAPTION_CHARS,
  instagramCaption,
  parseCarouselSlides,
  parseStoryFrames,
  sanitizeInstagramDraft,
  splitInstagramBody,
} from "./instagram-rules";
import type { Draft } from "@/shared/types";

const draft = (body: string, hashtags: string[] = []): Draft => ({
  platform: "instagram",
  body,
  hashtags,
});

/** A carousel that passes every gate, used as the base for failure cases. */
const goodSlides = [
  "Slide 1: Most teams batch content and still miss every deadline.",
  "Slide 2: The problem is not volume. It is that nobody owns the calendar.",
  "Slide 3: Pick one owner per pillar. Write it down.",
  "Slide 4: Batch on Monday. Schedule the same day.",
  "Slide 5: Review the top three posts every Friday.",
  "Slide 6: Save this and share it with whoever runs your calendar.",
].join("\n");

const goodStories = [
  "Story 1: Your calendar is the bottleneck, not your ideas.",
  "Story 2: Here is the one change that fixed ours.",
  "Story 3: Poll sticker — which one breaks first for you?",
].join("\n");

describe("sanitizeInstagramDraft", () => {
  it("leaves non-Instagram drafts alone", () => {
    const x: Draft = { platform: "x", body: "  spaced  ", hashtags: ["#a"] };
    assert.equal(sanitizeInstagramDraft(x), x);
  });

  it("trims to 5 hashtags", () => {
    const cleaned = sanitizeInstagramDraft(
      draft("Hook.", ["#a", "#b", "#c", "#d", "#e", "#f", "#g"]),
    );
    assert.deepEqual(cleaned.hashtags, ["#a", "#b", "#c", "#d", "#e"]);
  });

  it("dedupes hashtags case-insensitively before capping", () => {
    const cleaned = sanitizeInstagramDraft(
      draft("Hook.", ["#Brand", "#brand", "#BRAND", "#two", "#three"]),
    );
    assert.deepEqual(cleaned.hashtags, ["#Brand", "#two", "#three"]);
  });

  it("normalizes bare tags and drops empty ones", () => {
    const cleaned = sanitizeInstagramDraft(draft("Hook.", ["brand", "##x", " "]));
    assert.deepEqual(cleaned.hashtags, ["#brand", "#x"]);
  });

  it("normalizes line breaks and trims whitespace", () => {
    const cleaned = sanitizeInstagramDraft(
      draft("  Hook.   \n\n\n\n Body line.  \r\n\r\nEnd.  "),
    );
    assert.equal(cleaned.body, "Hook.\n\nBody line.\n\nEnd.");
  });

  it("does not touch a weak hook or a missing CTA", () => {
    const body = "A very ordinary opening line that says nothing at all.";
    assert.equal(sanitizeInstagramDraft(draft(body)).body, body);
  });

  it("applyInstagramAgent is the sanitizer", () => {
    const input = draft("Hook.  ", ["#a", "#a"]);
    assert.deepEqual(applyInstagramAgent(input), sanitizeInstagramDraft(input));
  });
});

describe("parsing", () => {
  it("reads Slide N: lines", () => {
    assert.equal(parseCarouselSlides(goodSlides).length, 6);
    assert.equal(
      parseCarouselSlides(goodSlides)[0],
      "Most teams batch content and still miss every deadline.",
    );
  });

  it("reads Story N: lines", () => {
    assert.equal(parseStoryFrames(goodStories).length, 3);
  });

  it("returns nothing for a plain caption", () => {
    assert.deepEqual(parseCarouselSlides("Just a caption."), []);
    assert.deepEqual(parseStoryFrames("Just a caption."), []);
  });
});

describe("countEmoji", () => {
  it("counts plain emoji", () => {
    assert.equal(countEmoji("one 🔥 two 🚀"), 2);
  });

  it("counts a ZWJ sequence as one glyph", () => {
    assert.equal(countEmoji("👩‍💻"), 1);
  });

  it("counts nothing in plain text", () => {
    assert.equal(countEmoji("no emoji here"), 0);
  });
});

describe("instagramGateFailures", () => {
  it("passes a clean caption", () => {
    assert.deepEqual(
      instagramGateFailures(
        draft("One sharp line.\n\nThen the detail.\n\nSave this.", ["#a"]),
      ),
      [],
    );
  });

  it("ignores non-Instagram drafts", () => {
    const li: Draft = { platform: "linkedin", body: "x".repeat(3000), hashtags: [] };
    assert.deepEqual(instagramGateFailures(li), []);
  });

  it("fails a caption over 2200 characters", () => {
    const failures = instagramGateFailures(
      draft(`Short hook.\n\n${"word ".repeat(INSTAGRAM_MAX_CAPTION_CHARS)}`),
    );
    assert.equal(
      failures.some((f) => f.includes("Caption is")),
      true,
    );
  });

  it("fails more than 5 hashtags", () => {
    const failures = instagramGateFailures(
      draft("Hook.", ["#a", "#b", "#c", "#d", "#e", "#f"]),
    );
    assert.equal(
      failures.some((f) => f.includes("6 hashtags")),
      true,
    );
  });

  it("fails a first line over 125 characters", () => {
    const failures = instagramGateFailures(draft("x".repeat(140)));
    assert.equal(
      failures.some((f) => f.includes("hook is 140 characters")),
      true,
    );
  });

  it("accepts a first line exactly at the limit", () => {
    const failures = instagramGateFailures(
      draft(`${"x".repeat(INSTAGRAM_HOOK_MAX_CHARS)}\n\nSave this.`),
    );
    assert.deepEqual(
      failures.filter((f) => f.includes("hook is")),
      [],
    );
  });

  it("fails more than 5 emoji", () => {
    const failures = instagramGateFailures(draft("Hook 🔥🚀✨💡🎯📈 here."));
    assert.equal(
      failures.some((f) => f.includes("6 emoji")),
      true,
    );
  });

  it("passes a well-formed carousel", () => {
    assert.deepEqual(instagramGateFailures(draft(goodSlides)), []);
  });

  it("fails a slide over 30 words", () => {
    const body = goodSlides.replace(
      "Slide 3: Pick one owner per pillar. Write it down.",
      `Slide 3: ${"word ".repeat(35)}`,
    );
    const failures = instagramGateFailures(draft(body));
    assert.equal(
      failures.some((f) => f.startsWith("Slide 3 is 35 words")),
      true,
    );
  });

  it("fails a carousel with too few slides", () => {
    const body = goodSlides.split("\n").slice(0, 4).join("\n");
    const failures = instagramGateFailures(draft(body));
    assert.equal(
      failures.some((f) => f.includes("4 carousel slides")),
      true,
    );
  });

  it("fails a carousel with too many slides", () => {
    const body = [
      ...Array.from({ length: 10 }, (_, i) => `Slide ${i + 1}: Short line here.`),
      "Slide 11: Save this post.",
    ].join("\n");
    const failures = instagramGateFailures(draft(body));
    assert.equal(
      failures.some((f) => f.includes("11 carousel slides")),
      true,
    );
  });

  it("fails when the last slide is not a CTA", () => {
    const body = goodSlides.replace(
      "Slide 6: Save this and share it with whoever runs your calendar.",
      "Slide 6: And that is the whole framework.",
    );
    const failures = instagramGateFailures(draft(body));
    assert.equal(
      failures.some((f) => f.includes("last slide is not a CTA")),
      true,
    );
  });

  it("passes stories with a sticker in the first three", () => {
    assert.deepEqual(instagramGateFailures(draft(goodStories)), []);
  });

  it("fails three stories with no sticker", () => {
    const body = goodStories.replace(
      "Story 3: Poll sticker — which one breaks first for you?",
      "Story 3: That is how we fixed it.",
    );
    const failures = instagramGateFailures(draft(body));
    assert.equal(
      failures.some((f) => f.includes("Stories 1-3 have no interactive sticker")),
      true,
    );
  });

  it("checks each window of three separately", () => {
    const body = [
      "Story 1: Hook line.",
      "Story 2: Poll sticker — which breaks first?",
      "Story 3: The fix.",
      "Story 4: More detail.",
      "Story 5: Even more detail.",
      "Story 6: Final thought.",
    ].join("\n");
    const failures = instagramGateFailures(draft(body));
    assert.equal(
      failures.some((f) => f.includes("Stories 4-6 have no interactive sticker")),
      true,
    );
  });

  it("does not apply carousel or story gates to a plain caption", () => {
    assert.deepEqual(instagramGateFailures(draft("One line. Save this.")), []);
  });
});

describe("splitInstagramBody", () => {
  it("keeps a plain caption whole", () => {
    const parts = splitInstagramBody("One line.\n\nTwo line.");
    assert.equal(parts.caption, "One line.\n\nTwo line.");
    assert.deepEqual(parts.slides, []);
    assert.deepEqual(parts.stories, []);
  });

  it("pulls slide lines out of the caption", () => {
    const parts = splitInstagramBody(
      ["The hook.", "", goodSlides, "", "Save this."].join("\n"),
    );
    assert.equal(parts.slides.length, 6);
    assert.equal(parts.caption, "The hook.\n\nSave this.");
    assert.equal(parts.caption.includes("Slide 1:"), false);
  });

  it("pulls story lines out of the caption", () => {
    const parts = splitInstagramBody(["Caption here.", goodStories].join("\n"));
    assert.equal(parts.stories.length, 3);
    assert.equal(parts.caption, "Caption here.");
  });

  it("separates slides from stories in the same body", () => {
    const parts = splitInstagramBody([goodSlides, goodStories].join("\n"));
    assert.equal(parts.slides.length, 6);
    assert.equal(parts.stories.length, 3);
    assert.equal(parts.caption, "");
  });

  it("collapses the blank lines left behind", () => {
    const parts = splitInstagramBody("Hook.\n\nSlide 1: a\nSlide 2: b\n\nEnd.");
    assert.equal(parts.caption, "Hook.\n\nEnd.");
  });

  it("instagramCaption returns just the caption", () => {
    assert.equal(instagramCaption(`Hook.\n${goodSlides}`), "Hook.");
  });

  it("tolerates other numbering punctuation", () => {
    assert.equal(splitInstagramBody("Slide 1 - a\nSlide 2. b").slides.length, 2);
  });

  it("does not treat prose mentioning a slide as a marker", () => {
    const parts = splitInstagramBody("We put it on the slide yesterday.");
    assert.deepEqual(parts.slides, []);
    assert.equal(parts.caption, "We put it on the slide yesterday.");
  });
});

describe("requested-format gate", () => {
  it("fails a carousel request with no slide markers", () => {
    const failures = instagramGateFailures(draft("Just a caption. Save this."), {
      format: "carousel",
    });
    assert.equal(
      failures.some((f) =>
        f.startsWith("Carousel requested but no slide markers"),
      ),
      true,
    );
  });

  it("passes a carousel request that has slides", () => {
    assert.deepEqual(
      instagramGateFailures(draft(goodSlides), { format: "carousel" }),
      [],
    );
  });

  it("fails a story request with no story markers", () => {
    const failures = instagramGateFailures(draft("Just a caption."), {
      format: "story",
    });
    assert.equal(
      failures.some((f) => f.startsWith("Story requested but no story markers")),
      true,
    );
  });

  it("passes a story request that has stories", () => {
    assert.deepEqual(
      instagramGateFailures(draft(goodStories), { format: "story" }),
      [],
    );
  });

  it("demands nothing when the format is caption", () => {
    assert.deepEqual(
      instagramGateFailures(draft("A caption. Save this."), {
        format: "caption",
      }),
      [],
    );
  });

  it("demands nothing when no format was requested", () => {
    assert.deepEqual(instagramGateFailures(draft("A caption.")), []);
  });

  it("measures the caption, not the slide lines, against the hook limit", () => {
    // A long slide line must not be mistaken for a long hook.
    const body = `Short hook.\nSlide 1: ${"x".repeat(200)}`;
    const failures = instagramGateFailures(draft(body));
    assert.equal(
      failures.some((f) => f.includes("hook is")),
      false,
    );
  });
});
