import { NextResponse } from "next/server";
import { requireAuthContext, requireCan } from "@/auth/server";
import { isAdminRole } from "@/authz/can";
import {
  getCampaignInWorkspace,
  requeueCampaign,
} from "@/db/queries/campaigns";
import { getLatestDraftsByPlatform } from "@/db/queries/drafts";
import { getRunSteps, type RunStep } from "@/db/queries/runs";
import {
  assertSameOrigin,
  catchRouteError,
  jsonErrorCode,
  requestIdFrom,
} from "@/lib/http";
import { AppError } from "@/shared/errors";
import { startCampaignRun } from "@/workflows/campaign-run";

export const runtime = "nodejs";

function redactSteps(steps: RunStep[], admin: boolean): RunStep[] {
  if (admin) return steps;
  return steps.map((step) => {
    if (step.step === "error") return step;
    return { ...step, output: {} };
  });
}

export async function GET(
  request: Request,
  { params }: RouteContext<"/api/campaigns/[id]">,
) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;

    const campaign = await getCampaignInWorkspace(ctx.workspaceId, id);
    if (!campaign) throw new AppError("not_found", "Campaign not found");

    const [steps, drafts] = await Promise.all([
      getRunSteps(id),
      getLatestDraftsByPlatform(id),
    ]);

    const res = NextResponse.json({
      campaign,
      steps: redactSteps(steps, isAdminRole(ctx.role)),
      drafts,
    });
    res.headers.set("x-request-id", requestId);
    return res;
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return catchRouteError(err, requestId);
  }
}

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/campaigns/[id]">,
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");
    const { id } = await params;

    const existing = await getCampaignInWorkspace(ctx.workspaceId, id);
    if (!existing) throw new AppError("not_found", "Campaign not found");

    try {
      const campaign = await requeueCampaign(id);
      if (!campaign) throw new AppError("not_found", "Campaign not found");
      startCampaignRun(campaign.id);
      const res = NextResponse.json({ id: campaign.id }, { status: 202 });
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : "";
      if (message === "Campaign is still running") {
        throw new AppError("conflict", "Campaign is still running");
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return catchRouteError(err, requestId);
  }
}
