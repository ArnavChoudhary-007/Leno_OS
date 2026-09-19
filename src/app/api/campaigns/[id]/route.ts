import { NextResponse } from "next/server";
import { getCampaign } from "@/db/queries/campaigns";
import { getLatestDraftsByPlatform } from "@/db/queries/drafts";
import { getRunSteps } from "@/db/queries/runs";

// Uses the DB — Node runtime, never edge.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/campaigns/[id]">,
) {
  const { id } = await params;

  const campaign = await getCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const [steps, drafts] = await Promise.all([
    getRunSteps(id),
    getLatestDraftsByPlatform(id),
  ]);

  return NextResponse.json({ campaign, steps, drafts });
}
