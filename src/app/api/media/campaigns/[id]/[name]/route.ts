import { NextResponse } from "next/server";
import { requireAuthContext } from "@/auth/server";
import { getCampaignInWorkspace } from "@/db/queries/campaigns";
import {
  parseFittedName,
  readFittedImage,
  readOriginalImage,
} from "@/creative/storage";
import { catchRouteError, jsonErrorCode, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/media/campaigns/[id]/[name]">,
) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await requireAuthContext();
    const { id, name } = await params;
    const kind = parseFittedName(name);
    if (!kind) throw new AppError("not_found", "Image not found");

    const campaign = await getCampaignInWorkspace(ctx.workspaceId, id);
    if (!campaign) throw new AppError("not_found", "Campaign not found");

    if (kind === "original") {
      const bytes = await readOriginalImage(ctx.workspaceId, id);
      if (!bytes) throw new AppError("not_found", "Image not found");
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "content-type": "application/octet-stream",
          "cache-control": "private, max-age=3600",
          "x-request-id": requestId,
        },
      });
    }

    const bytes = await readFittedImage(ctx.workspaceId, id, kind);
    if (!bytes) throw new AppError("not_found", "Image not found");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "private, max-age=3600",
        "x-request-id": requestId,
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return catchRouteError(err, requestId);
  }
}
