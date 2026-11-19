import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import sharp from "sharp";
import { CarouselQuerySchema } from "@/shared/schemas";
import { generateCarouselSlideSvg, type CarouselBrand } from "./carousel-svg";
import { renderInstagramSlide, slideTitleAndCopy } from "./instagram-carousel";

const brand: CarouselBrand = { name: "Leno", primaryColor: "#0F172A", secondaryColor: "#38BDF8" };

describe("Instagram carousel export", () => {
  it("rasterizes the actual SVG to a 1080 by 1350 JPEG", async () => {
    const slides = ["One clear hook.", "A focused idea. Explain it briefly.", "Save this for later."];
    for (const index of [0, 1, 2]) {
      const image = await renderInstagramSlide(slides, index, brand);
      const metadata = await sharp(image).metadata();
      assert.equal(metadata.format, "jpeg");
      assert.equal(metadata.width, 1080);
      assert.equal(metadata.height, 1350);
    }
  });

  it("rejects invalid or out-of-range slide indices before rendering", async () => {
    for (const index of [-1, 0.5, Number.NaN, 1, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(renderInstagramSlide(["Only slide."], index, brand), RangeError);
    }
  });

  it("splits a short headline from supporting copy without inventing text", () => {
    assert.deepEqual(slideTitleAndCopy("One idea. More detail."), { title: "One idea.", copy: "More detail." });
    assert.deepEqual(slideTitleAndCopy("One short idea"), { title: "One short idea", copy: "" });
    const long = "A long supporting explanation ".repeat(4).trim();
    assert.deepEqual(slideTitleAndCopy(long), { title: "", copy: long });
  });

  it("normalizes colors and prevents SVG attribute injection", () => {
    const svg = generateCarouselSlideSvg({
      slideNumber: 1, totalSlides: 1, title: "One idea", copy: "One detail",
      brand: { name: "Leno", primaryColor: 'red\"/><script>alert(1)</script>', secondaryColor: " 38BDF8 " },
    });
    assert.doesNotMatch(svg, /<script>/);
    assert.match(svg, /#0F172A/);
    assert.match(svg, /#38BDF8/);
  });

  it("validates exact query indices and requires a UUID draft ID", () => {
    const draftId = "0b7d73db-9e15-4a56-9e6b-cc3a9441bca3";
    assert.equal(CarouselQuerySchema.parse({ draftId }).slide, 0);
    assert.equal(CarouselQuerySchema.parse({ draftId, slide: "2" }).slide, 2);
    for (const slide of ["-1", "1junk", "1.5", "1e2", "", " 1", "9007199254740992"]) {
      assert.equal(CarouselQuerySchema.safeParse({ draftId, slide }).success, false);
    }
    assert.equal(CarouselQuerySchema.safeParse({ draftId: "another-workspace", slide: "0" }).success, false);
  });

  it("retains authentication, draft-specific workspace scope, and private caching", async () => {
    const source = await readFile(new URL("../app/api/og/carousel/route.tsx", import.meta.url), "utf8");
    assert.match(source, /export const runtime = "nodejs"/);
    assert.ok(source.indexOf("await requireAuthContext()") < source.indexOf("await getDraftInWorkspace(ctx.workspaceId, draftId)"));
    assert.match(source, /await getDraftInWorkspace\(ctx.workspaceId, draftId\)/);
    assert.match(source, /private, no-store/);
    assert.doesNotMatch(source, /getCurrentDraftForPlatform/);
  });
});
