import sharp from "sharp";
import { PLATFORM_IMAGE_SPECS, type ImagePlatform } from "./platform-specs";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Resizes one image to a platform's exact dimensions.
 *
 * - `rotate()` first, so a phone photo's EXIF orientation is applied before
 *   anything is cropped.
 * - `cover` + `attention` crops toward the busiest part of the frame rather
 *   than the middle, which keeps faces and products in shot.
 * - JPEG out, always: Instagram's publishing API rejects WebP.
 */
export async function resizeForPlatform(
  input: Buffer,
  platform: ImagePlatform,
): Promise<Buffer> {
  const spec = PLATFORM_IMAGE_SPECS[platform];

  return sharp(input)
    .rotate()
    .resize(spec.width, spec.height, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/**
 * Normalises an upload to JPEG for storage as the campaign original.
 * Rejects anything we can't safely process.
 */
export async function toStorableJpeg(input: Buffer): Promise<Buffer> {
  if (input.byteLength > MAX_IMAGE_BYTES) {
    throw new ImageError(
      `That image is ${(input.byteLength / 1024 / 1024).toFixed(1)} MB. The limit is 15 MB.`,
    );
  }

  let format: string | undefined;
  try {
    format = (await sharp(input).metadata()).format;
  } catch {
    throw new ImageError("That file isn't an image we can read.");
  }

  if (!format || !["jpeg", "png", "webp"].includes(format)) {
    throw new ImageError(
      `Images must be JPEG, PNG or WebP${format ? ` — that one is ${format}` : ""}.`,
    );
  }

  return sharp(input).rotate().jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}

/** A problem with the image itself, safe to show a user. */
export class ImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageError";
  }
}
