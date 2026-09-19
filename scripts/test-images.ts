/**
 * Checks the resizer against three awkward inputs and asserts every output
 * is exactly the size its platform expects, in JPEG.
 *
 *   npm run test:images
 *
 * Fixtures are generated with sharp, so there are no binaries in the repo.
 */
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  IMAGE_PLATFORMS,
  PLATFORM_IMAGE_SPECS,
} from "@/lib/images/platform-specs";
import { ImageError, resizeForPlatform, toStorableJpeg } from "@/lib/images/resize";

/** Wide landscape JPEG, the easy case. */
function landscapeJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 2400, height: 1350, channels: 3, background: "#1F6FEB" },
  })
    .jpeg()
    .toBuffer();
}

/** Tall portrait PNG — cropping to 16:9 has to throw most of it away. */
function portraitPng(): Promise<Buffer> {
  return sharp({
    create: { width: 900, height: 1600, channels: 4, background: "#F5A623" },
  })
    .png()
    .toBuffer();
}

/**
 * A phone photo held sideways: stored landscape with EXIF orientation 6,
 * meaning it should be treated as portrait. If rotate() is missing, the
 * output is visibly wrong while still having the right dimensions — so we
 * assert on the orientation sharp reports after processing.
 */
function exifRotatedJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#2C6249" },
  })
    .withExifMerge({ IFD0: { Orientation: "6" } })
    .jpeg()
    .toBuffer();
}

async function main() {
  const fixtures: [string, Buffer][] = [
    ["landscape JPEG 2400x1350", await landscapeJpeg()],
    ["portrait PNG 900x1600", await portraitPng()],
    ["EXIF-rotated phone photo 1600x1200 (orientation 6)", await exifRotatedJpeg()],
  ];

  let checks = 0;

  for (const [label, input] of fixtures) {
    const source = await sharp(input).metadata();
    console.log(`\n${label}  (source ${source.width}x${source.height} ${source.format})`);

    for (const platform of IMAGE_PLATFORMS) {
      const spec = PLATFORM_IMAGE_SPECS[platform];
      const out = await resizeForPlatform(input, platform);
      const meta = await sharp(out).metadata();

      assert.equal(meta.format, "jpeg", `${platform}: must be JPEG, got ${meta.format}`);
      assert.equal(meta.width, spec.width, `${platform}: width`);
      assert.equal(meta.height, spec.height, `${platform}: height`);
      checks += 3;

      console.log(
        `  ${platform.padEnd(10)} ${String(meta.width).padStart(4)}x${String(meta.height).padEnd(4)} ` +
          `${spec.ratio.padEnd(7)} ${(out.byteLength / 1024).toFixed(0)}kB  ok`,
      );
    }
  }

  // EXIF orientation must be applied, not carried through.
  const rotated = await resizeForPlatform(await exifRotatedJpeg(), "x");
  const rotatedMeta = await sharp(rotated).metadata();
  assert.ok(
    rotatedMeta.orientation === undefined || rotatedMeta.orientation === 1,
    `EXIF orientation should be baked in, got ${rotatedMeta.orientation}`,
  );
  checks += 1;

  // Rejections.
  await assert.rejects(
    () => toStorableJpeg(Buffer.from("this is not an image")),
    (err: Error) => err instanceof ImageError,
    "a non-image must be rejected",
  );
  await assert.rejects(
    () => toStorableJpeg(Buffer.alloc(16 * 1024 * 1024)),
    (err: Error) => err instanceof ImageError && err.message.includes("15 MB"),
    "an oversized image must be rejected",
  );
  checks += 2;

  console.log(`\n${checks} assertions passed.`);
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
