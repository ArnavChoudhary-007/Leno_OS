import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImagePlatform } from "./platform-specs";
import { toStorableJpeg } from "./resize";

/**
 * Campaign originals live on disk, not in the database. A campaign "has an
 * image" if and only if its original.jpg exists — there is no column to
 * keep in sync.
 *
 * Resized versions are never stored; the serving route derives them on
 * demand and lets HTTP caching do the rest.
 */
const STORAGE_DIR = process.env.IMAGE_STORAGE_DIR ?? "./storage/images";

/** UUIDs only — this string becomes a path segment. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidCampaignId(id: string): boolean {
  return UUID.test(id);
}

function originalPath(campaignId: string): string {
  if (!isValidCampaignId(campaignId)) {
    throw new Error(`Refusing to build a path from "${campaignId}"`);
  }
  return path.join(path.resolve(STORAGE_DIR), campaignId, "original.jpg");
}

/**
 * Converts an upload to JPEG and saves it as this campaign's original.
 * Also the entry point for a generated image, once that step exists.
 */
export async function saveOriginal(
  campaignId: string,
  input: Buffer,
): Promise<void> {
  const jpeg = await toStorableJpeg(input);
  const destination = originalPath(campaignId);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, jpeg);
}

/** The original, or null when this campaign has no image. */
export async function readOriginal(campaignId: string): Promise<Buffer | null> {
  try {
    return await readFile(originalPath(campaignId));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function hasOriginal(campaignId: string): Promise<boolean> {
  return (await readOriginal(campaignId)) !== null;
}

/**
 * Where a platform's version of this campaign's image is served from.
 * Root-relative unless PUBLIC_BASE_URL is set, which is what a published
 * post needs.
 */
export function imageUrl(
  campaignId: string,
  platform: ImagePlatform | "original",
): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/api/images/${campaignId}/${platform}`;
}
