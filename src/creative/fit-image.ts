import sharp from "sharp";
import { CoverCropBoxSchema, ImageFitSpecSchema } from "@/shared/schemas";
import type { CoverCropBox, ImageFitSpec } from "@/shared/types";

/**
 * Center cover-crop: the largest source rectangle that matches `dest`
 * aspect, then callers resize that crop to dest.width × dest.height.
 */
export function coverCropBox(
  sourceWidth: number,
  sourceHeight: number,
  dest: ImageFitSpec,
): CoverCropBox {
  ImageFitSpecSchema.parse(dest);
  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new Error("Source image must be at least 1×1");
  }

  const srcAspect = sourceWidth / sourceHeight;
  const destAspect = dest.width / dest.height;

  let width: number;
  let height: number;
  if (srcAspect > destAspect) {
    height = sourceHeight;
    width = Math.round(sourceHeight * destAspect);
  } else {
    width = sourceWidth;
    height = Math.round(sourceWidth / destAspect);
  }

  width = Math.max(1, Math.min(sourceWidth, width));
  height = Math.max(1, Math.min(sourceHeight, height));

  const left = Math.max(0, Math.round((sourceWidth - width) / 2));
  const top = Math.max(0, Math.round((sourceHeight - height) / 2));

  return CoverCropBoxSchema.parse({
    left: Math.min(left, sourceWidth - width),
    top: Math.min(top, sourceHeight - height),
    width,
    height,
  });
}

export async function fitImageToSpec(
  input: Buffer,
  dest: ImageFitSpec,
): Promise<Buffer> {
  ImageFitSpecSchema.parse(dest);
  const meta = await sharp(input).rotate().metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  const crop = coverCropBox(sourceWidth, sourceHeight, dest);

  return sharp(input)
    .rotate()
    .extract(crop)
    .resize(dest.width, dest.height, { fit: "fill" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}
