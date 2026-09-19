import { NextResponse } from "next/server";
import { recoverStuckRuns } from "@/agents/orchestrator/recover";
import { getCampaign } from "@/db/queries/campaigns";
import { getCurrentDraftsByPlatform } from "@/db/queries/drafts";
import { getRunSteps } from "@/db/queries/runs";

// Uses the DB — Node runtime, never edge.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/campaigns/[id]">,
) {
  const { id } = await params;

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
}
