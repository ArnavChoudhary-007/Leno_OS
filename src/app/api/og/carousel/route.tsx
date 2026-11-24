import { ImageResponse } from "next/og";
import { requireAuthContext } from "@/auth/server";
import { loadBrandVisual } from "@/creative/load";
import { getDraftInWorkspace } from "@/db/queries/drafts";
import { parseCarouselSlides } from "@/agents/platforms/instagram-rules";
import { renderInstagramSlide } from "@/creative/instagram-carousel";
import { CarouselQuerySchema } from "@/shared/schemas";
import { splitCarouselSlides } from "@/creative/slides";
import { CarouselSlideMarkup, OG_SIZE } from "@/creative/templates";
import { jsonErrorCode, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";

export const runtime = "nodejs";

function carouselResponse(brand: Awaited<ReturnType<typeof loadBrandVisual>>, slides: string[], slide: number) {
  return new ImageResponse(
    <CarouselSlideMarkup brand={brand} text={slides[slide]} index={slide} total={slides.length} />,
    { ...OG_SIZE, headers: { "cache-control": "private, no-store" } },
  );
}

/**
 * One branded carousel slide (1080×1080).
 *
 *   /api/og/carousel?draftId=<uuid>&slide=0
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await requireAuthContext();
    const { searchParams } = new URL(request.url);
    if (searchParams.has("text")) {
      throw new AppError("invalid_body", "Provide draftId");
    }
    const query = CarouselQuerySchema.safeParse({
      draftId: searchParams.get("draftId"),
      slide: searchParams.get("slide") ?? undefined,
    });
    if (!query.success) {
      throw new AppError("invalid_body", "Provide a valid draftId and nonnegative integer slide index");
    }
    const { draftId, slide } = query.data;

    const draft = await getDraftInWorkspace(ctx.workspaceId, draftId);
    if (!draft) throw new AppError("not_found", "Draft not found");

    const instagramSlides = draft.platform === "instagram" ? parseCarouselSlides(draft.body) : [];
    const slides = instagramSlides.length ? instagramSlides : splitCarouselSlides(draft.body);
    if (slide >= slides.length) {
      throw new AppError(
        "invalid_body",
        `Slide ${slide} out of range (0–${slides.length - 1})`,
      );
    }

    const brand = await loadBrandVisual(ctx.workspaceId);
    if (instagramSlides.length) {
      const jpeg = await renderInstagramSlide(slides, slide, {
        name: brand.name, primaryColor: brand.primary, secondaryColor: brand.secondary,
      });
      return new Response(new Uint8Array(jpeg), {
        headers: {
          "content-type": "image/jpeg",
          "content-length": String(jpeg.byteLength),
          "cache-control": "private, no-store",
          "x-request-id": requestId,
        },
      });
    }
    return carouselResponse(brand, slides, slide);
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return jsonErrorCode("job_failed", { requestId });
  }
}
