import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PlatformIdSchema } from "@/shared/schemas";
import type { PlatformId } from "@/shared/types";

const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export function campaignUploadDir(
  workspaceId: string,
  campaignId: string,
): string {
  assertSafeId(workspaceId);
  assertSafeId(campaignId);
  return path.join(UPLOAD_ROOT, workspaceId, campaignId);
}

export function originalImagePath(
  workspaceId: string,
  campaignId: string,
): string {
  return path.join(campaignUploadDir(workspaceId, campaignId), "original");
}

export function fittedImagePath(
  workspaceId: string,
  campaignId: string,
  platform: PlatformId,
): string {
  return path.join(
    campaignUploadDir(workspaceId, campaignId),
    `${platform}.jpg`,
  );
}

export function fittedImageUrl(campaignId: string, platform: PlatformId): string {
  assertSafeId(campaignId);
  return `/api/media/campaigns/${campaignId}/${platform}.jpg`;
}

export async function saveOriginalImage(
  workspaceId: string,
  campaignId: string,
  bytes: Buffer,
): Promise<void> {
  const dir = campaignUploadDir(workspaceId, campaignId);
  await mkdir(dir, { recursive: true });
  await writeFile(originalImagePath(workspaceId, campaignId), bytes);
}

export async function readOriginalImage(
  workspaceId: string,
  campaignId: string,
): Promise<Buffer | null> {
  try {
    return await readFile(originalImagePath(workspaceId, campaignId));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function saveFittedImage(
  workspaceId: string,
  campaignId: string,
  platform: PlatformId,
  bytes: Buffer,
): Promise<void> {
  const dir = campaignUploadDir(workspaceId, campaignId);
  await mkdir(dir, { recursive: true });
  await writeFile(fittedImagePath(workspaceId, campaignId, platform), bytes);
}

export async function readFittedImage(
  workspaceId: string,
  campaignId: string,
  platform: PlatformId,
): Promise<Buffer | null> {
  try {
    return await readFile(fittedImagePath(workspaceId, campaignId, platform));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export function parseFittedName(name: string): PlatformId | "original" | null {
  if (name === "original") return "original";
  const match = /^([a-z]+)\.jpg$/.exec(name);
  if (!match) return null;
  const parsed = PlatformIdSchema.safeParse(match[1]);
  return parsed.success ? parsed.data : null;
}

function assertSafeId(value: string): void {
  if (!/^[-a-zA-Z0-9]+$/.test(value)) {
    throw new Error("Invalid upload path");
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "ENOENT"
  );
}
