import { NextResponse } from "next/server";
import { getBrandProfile } from "@/db/queries/brand";
import { insertCampaign } from "@/db/queries/campaigns";
import { CampaignBriefSchema } from "@/shared/schemas";
import { startCampaignRun } from "@/workflows/campaign-run";

// Uses the DB and spawns background work — Node runtime, never edge.
export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = CampaignBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid brief",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Every agent prompt is built from the brand card; without one there is
  // nothing to write against.
  const brand = await getBrandProfile();
  if (!brand) {
    return NextResponse.json(
      { error: "No brand profile yet — set one up at /brand before running a campaign." },
      { status: 400 },
    );
  }

  const campaign = await insertCampaign(parsed.data.brief);
  startCampaignRun(campaign.id);

  return NextResponse.json({ id: campaign.id }, { status: 202 });
}
