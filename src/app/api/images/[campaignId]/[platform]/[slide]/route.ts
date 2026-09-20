import { requireAuthContext } from "@/auth/server";
import { splitInstagramBody } from "@/agents/platforms";
import { loadBrandVisual } from "@/creative/load";
import { getCurrentDraftForPlatform } from "@/db/queries/drafts";
import { getCampaignInWorkspace } from "@/db/queries/campaigns";
import { isValidCampaignId } from "@/lib/images/storage";
import {
  parseSlideSegment,
  renderSlideJpeg,
  slideKindFor,
  slideTitleAndCopy,
} from "@/lib/images/slides";

// sharp is a native module and this reads the database — Node, never edge.
export const runtime = "nodejs";

/**
 * One rendered Instagram carousel slide:
 *
 *   /api/images/{campaignId}/instagram/slide-1
 *
 * Unlike the sibling route, this is not a crop of an uploaded photo — it
 * is generated from the draft's "Slide N:" lines and the brand colors, so
 * it needs auth: an unpublished draft's copy should not be readable by
 * anyone holding the campaign UUID.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/images/[campaignId]/[platform]/[slide]">,
) {
  const { campaignId, platform, slide } = await params;

  if (!isValidCampaignId(campaignId) || platform !== "instagram") {
    return new Response("Not found", { status: 404 });
  }

  const slideNumber = parseSlideSegment(slide);
  if (slideNumber === null) {
    return new Response("Not found", { status: 404 });
  }

  const ctx = await requireAuthContext();

  const campaign = await getCampaignInWorkspace(ctx.workspaceId, campaignId);
  if (!campaign) {
    return new Response("Not found", { status: 404 });
  }

  const draft = await getCurrentDraftForPlatform(campaignId, "instagram");
  if (!draft) {
    return new Response("Not found", { status: 404 });
  }

  const { slides } = splitInstagramBody(draft.body);
  if (slideNumber > slides.length) {
    return new Response("Not found", { status: 404 });
  }

  const index = slideNumber - 1;
  const { title, copy } = slideTitleAndCopy(slides[index]);
  const brand = await loadBrandVisual(ctx.workspaceId);

  const jpeg = await renderSlideJpeg({
    slideNumber,
    totalSlides: slides.length,
    title,
    copy,
    brand: {
      name: brand.name,
      primaryColor: brand.primary,
      secondaryColor: brand.secondary,
    },
    kind: slideKindFor(index, slides.length),
  });

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(jpeg.byteLength),
      // Draft text changes under a stable URL, so this must revalidate.
      "Cache-Control": "private, no-cache",
    },
  });
}
