import { NextResponse } from "next/server";
import { authorizeMutation } from "@/auth/mutation";
import { getCampaignInWorkspace, requeueFailedCampaign } from "@/db/queries/campaigns";
import { catchRouteError, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";
import { startCampaignRun } from "@/workflows/campaign-run";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RouteContext<"/api/campaigns/[id]/retry">) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await authorizeMutation(request, "mutate", "campaign");
    const { id } = await params;
    if (!(await getCampaignInWorkspace(ctx.workspaceId, id))) throw new AppError("not_found", "Campaign not found");
    const campaign = await requeueFailedCampaign(id);
    if (!campaign) throw new AppError("conflict", "Only a failed campaign can be retried.");
    startCampaignRun(id);
    return NextResponse.json({ id, status: campaign.status }, { status: 202 });
  } catch (err) {
    return catchRouteError(err, requestId);
  }
}
