import { NextResponse } from "next/server";

// TODO: implement — validate the campaign brief, insert a `campaigns` row,
// call workflows/campaign-run.ts startCampaignRun(), return the new id.
export async function POST() {
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 },
  );
}
