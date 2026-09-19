import { NextResponse } from "next/server";
import { getCampaign, requeueFailedCampaign } from "@/db/queries/campaigns";
import { startCampaignRun } from "@/workflows/campaign-run";

// Uses the DB and starts background work — Node runtime, never edge.
export const runtime = "nodejs";

/**
 * Runs a failed campaign again. New drafts continue the existing version
 * numbering and supersede the older ones, so the history stays intact.
 */
export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/campaigns/[id]/retry">,
) {
  const { id } = await params;

  const campaign = await getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const requeued = await requeueFailedCampaign(id);
  if (!requeued) {
    return NextResponse.json(
      {
        error: `Only a failed campaign can be retried — this one is ${campaign.status}.`,
      },
      { status: 409 },
    );
  }

  startCampaignRun(id);
  return NextResponse.json({ id, status: requeued.status }, { status: 202 });
}
