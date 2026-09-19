import { ImageResponse } from "next/og";
import { requireAuthContext } from "@/auth/server";
import { loadBrandVisual, loadDraftBody } from "@/creative/load";
import { splitCarouselSlides } from "@/creative/slides";
import { CarouselSlideMarkup, OG_SIZE } from "@/creative/templates";
import { jsonErrorCode, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";

export const runtime = "nodejs";

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
    const draftId = searchParams.get("draftId");
    const slideRaw = searchParams.get("slide") ?? "0";
    const slide = Number.parseInt(slideRaw, 10);

    if (searchParams.get("text")) {
      throw new AppError("invalid_body", "Provide draftId");
    }
    if (!draftId) {
      throw new AppError("invalid_body", "draftId is required");
    }
    if (!Number.isFinite(slide) || slide < 0) {
      throw new AppError("invalid_body", "Invalid slide index");
    }

    const body = await loadDraftBody(ctx.workspaceId, draftId);
    if (!body) throw new AppError("not_found", "Draft not found");

    const slides = splitCarouselSlides(body);
    if (slide >= slides.length) {
      throw new AppError(
        "invalid_body",
        `Slide ${slide} out of range (0–${slides.length - 1})`,
      );
    }

    const brand = await loadBrandVisual(ctx.workspaceId);
    return new ImageResponse(
      (
        <CarouselSlideMarkup
          brand={brand}
          text={slides[slide]}
          index={slide}
          total={slides.length}
        />
      ),
      { ...OG_SIZE },
    );
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return jsonErrorCode("job_failed", { requestId });
  }
}
