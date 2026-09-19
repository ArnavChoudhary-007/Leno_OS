import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { coverCropBox, fitImageToSpec } from "./fit-image";

describe("coverCropBox", () => {
  it("crops the sides of a wide source for a square dest", () => {
    const box = coverCropBox(200, 100, { width: 1024, height: 1024, ratio: "1:1" });
    assert.equal(box.width, 100);
    assert.equal(box.height, 100);
    assert.equal(box.left, 50);
    assert.equal(box.top, 0);
  });

  it("crops the top and bottom of a tall source for a landscape dest", () => {
    const box = coverCropBox(100, 200, { width: 16, height: 9, ratio: "16:9" });
    assert.equal(box.width, 100);
    assert.equal(box.left, 0);
    assert.ok(box.height < 200);
    assert.ok(box.top > 0);
  });

  it("uses the full frame when the ratio already matches", () => {
    const box = coverCropBox(1024, 576, { width: 1024, height: 576, ratio: "16:9" });
    assert.deepEqual(box, { left: 0, top: 0, width: 1024, height: 576 });
  });
});

describe("fitImageToSpec", () => {
  it("emits a JPEG at the platform pixel size", async () => {
    const source = await sharp({
      create: {
        width: 80,
        height: 40,
        channels: 3,
        background: { r: 20, g: 40, b: 80 },
      },
    })
      .png()
      .toBuffer();

    const fitted = await fitImageToSpec(source, {
      width: 1024,
      height: 576,
      ratio: "16:9",
    });
    const meta = await sharp(fitted).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, 1024);
    assert.equal(meta.height, 576);
  });
});
