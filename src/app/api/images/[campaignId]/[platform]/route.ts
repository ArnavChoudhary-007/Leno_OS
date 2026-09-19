import { isImagePlatform } from "@/lib/images/platform-specs";
import { resizeForPlatform } from "@/lib/images/resize";
import { isValidCampaignId, readOriginal } from "@/lib/images/storage";

// sharp is a native module and reads from disk — Node runtime, never edge.
export const runtime = "nodejs";

/**
 * Serves a campaign's image at one platform's exact dimensions, resized on
 * demand. Nothing is written: the URL is immutable per campaign+platform,
 * so the cache header does the work a stored copy would.
 *
 * `/api/images/{campaignId}/original` returns the uploaded source instead.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/images/[campaignId]/[platform]">,
) {
  const { campaignId, platform } = await params;

  // Both segments are validated before touching the filesystem.
  if (!isValidCampaignId(campaignId)) {
    return new Response("Not found", { status: 404 });
  }
  if (platform !== "original" && !isImagePlatform(platform)) {
    return new Response("Not found", { status: 404 });
  }

  const original = await readOriginal(campaignId);
  if (!original) {
    return new Response("Not found", { status: 404 });
  }

  const body =
    platform === "original"
      ? original
      : await resizeForPlatform(original, platform);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
