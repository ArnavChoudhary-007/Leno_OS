import { ImageResponse } from "next/og";
import { requireAuthContext } from "@/auth/server";
import { loadBrandVisual, loadDraftBody } from "@/creative/load";
import { OG_SIZE, QuoteCardMarkup } from "@/creative/templates";
import { jsonErrorCode, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";

export const runtime = "nodejs";

/**
 * Branded quote card (1080×1080).
 *
 *   /api/og/quote?draftId=<uuid>
 */
export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await requireAuthContext();
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get("draftId");
    if (searchParams.get("text")) {
      throw new AppError("invalid_body", "Provide draftId");
    }
    if (!draftId) {
      throw new AppError("invalid_body", "Provide draftId");
    }

    const quote = await loadDraftBody(ctx.workspaceId, draftId);
    if (!quote) throw new AppError("not_found", "Draft not found");

    const brand = await loadBrandVisual(ctx.workspaceId);
    return new ImageResponse(
      <QuoteCardMarkup brand={brand} quote={quote} />,
      { ...OG_SIZE },
    );
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return jsonErrorCode("job_failed", { requestId });
  }
}
