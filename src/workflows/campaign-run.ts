import { after } from "next/server";

/**
 * Kicks off a campaign run in the background after a request (e.g. the
 * campaign-create API route) has already responded, using Next's
 * `after()` so the orchestrator run doesn't block the response.
 *
 * TODO: implement — call agents/orchestrator's runCampaign(campaignId)
 * inside after(), and make sure failures update the campaign's status
 * to 'failed' instead of disappearing silently.
 */
export function startCampaignRun(campaignId: string): void {
  after(() => {
    void campaignId;
    throw new Error("startCampaignRun() is not implemented yet");
  });
}
