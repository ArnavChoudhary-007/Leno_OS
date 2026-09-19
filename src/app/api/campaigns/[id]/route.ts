import { NextResponse } from "next/server";
<<<<<<< HEAD
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
import { blueskyConfigured } from "@/tools/social/bluesky";
import { linkedinConnected } from "@/tools/social/linkedin";
import { startCampaignRun } from "@/workflows/campaign-run";
=======
import { recoverStuckRuns } from "@/agents/orchestrator/recover";
import { getCampaign } from "@/db/queries/campaigns";
import { getCurrentDraftsByPlatform } from "@/db/queries/drafts";
import { getRunSteps } from "@/db/queries/runs";
>>>>>>> origin/main

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

<<<<<<< HEAD
    const campaign = await getCampaignInWorkspace(ctx.workspaceId, id);
    if (!campaign) throw new AppError("not_found", "Campaign not found");

    const [steps, drafts, linkedin] = await Promise.all([
      getRunSteps(id),
      getLatestDraftsByPlatform(id),
      linkedinConnected(ctx.workspaceId),
    ]);

    const res = NextResponse.json({
      campaign,
      steps: redactSteps(steps, isAdminRole(ctx.role)),
      drafts,
      destinations: {
        bluesky: blueskyConfigured(),
        linkedin,
      },
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
=======
  // Anyone polling a campaign is a good moment to reclaim dead runs.
  await recoverStuckRuns().catch((err) =>
    console.error("[api] stuck-run recovery failed:", err),
  );

  const campaign = await getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const [steps, drafts] = await Promise.all([
    getRunSteps(id),
    getCurrentDraftsByPlatform(id),
  ]);

  return NextResponse.json({ campaign, steps, drafts });
>>>>>>> origin/main
}
