import sharp from "sharp";
import { AppError } from "@/shared/errors";

export const MAX_CAMPAIGN_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function readCampaignImageFile(file: File): Promise<Buffer> {
  if (file.size <= 0) {
    throw new AppError("invalid_body", "The image file is empty.");
  }
  if (file.size > MAX_CAMPAIGN_IMAGE_BYTES) {
    throw new AppError("invalid_body", "Images can be at most 8 MB.");
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    throw new AppError(
      "invalid_body",
      "Use a JPEG, PNG, or WebP image.",
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await sharp(bytes).metadata();
    if (!meta.width || !meta.height) {
      throw new Error("no dimensions");
    }
  } catch {
    throw new AppError("invalid_body", "That file is not a readable image.");
  }
  return bytes;
}
