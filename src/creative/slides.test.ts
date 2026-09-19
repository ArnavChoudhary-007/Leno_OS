import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitCarouselSlides } from "./slides";
import { contrastingInk, luminance } from "./colors";

describe("splitCarouselSlides", () => {
  it("returns a single slide for a short post", () => {
    const slides = splitCarouselSlides("Short hook about the product.");
    assert.equal(slides.length, 1);
    assert.match(slides[0], /Short hook/);
  });

  it("splits long copy into multiple slides", () => {
    const body =
      "First sentence lands the hook hard. Second sentence adds the benefit people care about. Third sentence brings the product in. Fourth sentence closes with a clear CTA for launch week.";
    const slides = splitCarouselSlides(body);
    assert.ok(slides.length >= 2);
    assert.ok(slides.length <= 5);
    assert.equal(slides.join(" ").replace(/\s+/g, " "), body);
  });
});

describe("contrastingInk", () => {
  it("picks light ink on dark backgrounds", () => {
    assert.equal(contrastingInk("#1F6FEB"), "#FFFFFF");
    assert.ok(luminance("#1F6FEB") < 0.45);
  });

  it("picks dark ink on light backgrounds", () => {
    assert.equal(contrastingInk("#F5A623"), "#0A0A0A");
  });
});
