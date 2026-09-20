import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CAROUSEL_HEIGHT,
  CAROUSEL_WIDTH,
  generateCarouselSlideSvg,
  generateCarouselSvgs,
  wrapText,
  type CarouselBrand,
} from "./carousel-svg";

const brand: CarouselBrand = {
  name: "Loopwave",
  primaryColor: "#0F172A",
  secondaryColor: "#38BDF8",
};

const slide = (overrides: Partial<Parameters<typeof generateCarouselSlideSvg>[0]> = {}) =>
  generateCarouselSlideSvg({
    slideNumber: 1,
    totalSlides: 5,
    title: "The calendar is the bottleneck",
    copy: "Most teams blame ideas. It is almost always the calendar.",
    brand,
    ...overrides,
  });

describe("wrapText", () => {
  it("wraps on words", () => {
    assert.deepEqual(wrapText("one two three four", 9, 5), [
      "one two",
      "three",
      "four",
    ]);
  });

  it("caps at maxLines", () => {
    assert.equal(wrapText("a b c d e f g h", 1, 3).length, 3);
  });

  it("gives an over-long word its own line", () => {
    assert.deepEqual(wrapText("short abcdefghijklmnop", 6, 3), [
      "short",
      "abcdefghijklmnop",
    ]);
  });

  it("returns one empty line for empty text", () => {
    assert.deepEqual(wrapText("   ", 20, 3), [""]);
  });
});

describe("generateCarouselSlideSvg", () => {
  it("renders a 4:5 canvas", () => {
    const svg = slide();
    assert.equal(CAROUSEL_WIDTH, 1080);
    assert.equal(CAROUSEL_HEIGHT, 1350);
    assert.equal(svg.includes(`viewBox="0 0 1080 1350"`), true);
  });

  it("escapes XML in the title, copy and brand name", () => {
    const svg = generateCarouselSlideSvg({
      slideNumber: 1,
      totalSlides: 3,
      title: `5 & 6 <are> "tips"`,
      copy: "a < b & c",
      brand: { ...brand, name: "Loop & Wave" },
    });
    assert.equal(svg.includes("<are>"), false);
    assert.equal(svg.includes("&amp;"), true);
    assert.equal(svg.includes("Loop &amp; Wave"), true);
  });

  it("does not paint an opaque rect over the gradient", () => {
    // The Python source drew the gradient then covered it. Guard against
    // that regression: the gradient fill must be the last full-bleed rect.
    const svg = slide();
    const gradientRect = svg.lastIndexOf('fill="url(#bg1)"');
    const solidRect = svg.lastIndexOf(`fill="${brand.primaryColor}"`);
    assert.equal(gradientRect > solidRect, true);
  });

  it("uses no invalid line-height attribute", () => {
    assert.equal(slide().includes("line-height"), false);
  });

  it("renders one progress dot per slide", () => {
    const svg = slide({ totalSlides: 7 });
    assert.equal((svg.match(/<circle /g) ?? []).length, 7);
  });

  it("zero-pads the slide counter", () => {
    assert.equal(slide({ slideNumber: 2, totalSlides: 9 }).includes("02 / 09"), true);
  });
});

describe("generateCarouselSvgs", () => {
  it("returns one SVG per slide", () => {
    const svgs = generateCarouselSvgs(
      [
        { title: "Hook", copy: "a" },
        { title: "Middle", copy: "b" },
        { title: "Save this", copy: "c" },
      ],
      brand,
    );
    assert.equal(svgs.length, 3);
    assert.equal(svgs[0].includes("01 / 03"), true);
    assert.equal(svgs[2].includes("03 / 03"), true);
  });

  it("gives the hook and CTA slides a different wash from the middle", () => {
    const [hook, middle, cta] = generateCarouselSvgs(
      [
        { title: "Hook", copy: "a" },
        { title: "Middle", copy: "b" },
        { title: "Save this", copy: "c" },
      ],
      brand,
    );
    assert.equal(hook.includes(`${brand.secondaryColor}33`), true);
    assert.equal(cta.includes(`${brand.secondaryColor}22`), true);
    assert.equal(
      middle.includes(`${brand.secondaryColor}33`) ||
        middle.includes(`${brand.secondaryColor}22`),
      false,
    );
  });

  it("handles a single slide", () => {
    const svgs = generateCarouselSvgs([{ title: "Only", copy: "one" }], brand);
    assert.equal(svgs.length, 1);
    assert.equal(svgs[0].includes("01 / 01"), true);
  });
});
