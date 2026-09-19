import { NextResponse } from "next/server";
import { requireAuthContext, requireCan } from "@/auth/server";
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

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");
    await consumeRateLimit(RATE_LIMITS.campaignCreate(ctx.userId));

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("invalid_body", "Body must be JSON");
    }

    const parsed = CampaignBriefSchema.safeParse(body);
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
      brief: parsed.data.brief,
      brandId: brand.id,
    });
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
