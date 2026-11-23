import { NextResponse } from "next/server";
import { requireAuthContext, requireCan } from "@/auth/server";
import { saveOriginalImage } from "@/creative/storage";
import { readCampaignImageFile } from "@/creative/read-upload";
import { getBrandProfile } from "@/db/queries/brand";
import { insertCampaign } from "@/db/queries/campaigns";
import {
  assertSameOrigin,
  catchRouteError,
  requestIdFrom,
  jsonErrorCode,
} from "@/lib/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { AppError } from "@/shared/errors";
import { CampaignBriefSchema } from "@/shared/schemas";
import { startCampaignRun } from "@/workflows/campaign-run";
import { withRequestedPlatforms } from "@/agents/orchestrator/plan";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");
    await consumeRateLimit(RATE_LIMITS.campaignCreate(ctx.userId));

    const { brief, platforms, image } = await readBrief(request);

    const parsed = CampaignBriefSchema.safeParse({ brief, platforms });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_body",
            message: "Invalid brief",
            issues: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    const brand = await getBrandProfile(ctx.workspaceId);
    if (!brand) {
      throw new AppError(
        "invalid_body",
        "No brand profile yet — set one up at /brand before running a campaign.",
      );
    }

    const campaign = await insertCampaign({
      workspaceId: ctx.workspaceId,
      createdBy: ctx.userId,
      brief: withRequestedPlatforms(parsed.data.brief, parsed.data.platforms),
      brandId: brand.id,
    });

    if (image) {
      await saveOriginalImage(ctx.workspaceId, campaign.id, image);
    }

    startCampaignRun(campaign.id);

    const res = NextResponse.json({ id: campaign.id }, { status: 202 });
    res.headers.set("x-request-id", requestId);
    return res;
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return catchRouteError(err, requestId);
  }
}

async function readBrief(
  request: Request,
): Promise<{ brief: unknown; platforms: unknown; image: Buffer | null }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("image");
    let image: Buffer | null = null;
    if (file instanceof File && file.size > 0) {
      image = await readCampaignImageFile(file);
    }
    const platforms = form.getAll("platforms").filter((p) => typeof p === "string");
    return {
      brief: form.get("brief"),
      platforms: platforms.length > 0 ? platforms : undefined,
      image,
    };
  }

  try {
    const body: unknown = await request.json();
    const brief =
      body && typeof body === "object" && "brief" in body
        ? body.brief
        : undefined;
    const platforms =
      body && typeof body === "object" && "platforms" in body
        ? body.platforms
        : undefined;
    return { brief, platforms, image: null };
  } catch {
    throw new AppError("invalid_body", "Body must be JSON or multipart form data");
  }
}
