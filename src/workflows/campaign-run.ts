import { after } from "next/server";
import { runCampaign } from "@/agents/orchestrator";

/**
 * Kicks off a campaign run after the response has gone out, so the POST
 * that created the campaign returns immediately. runCampaign never throws
 * and records its own failures, so nothing here is left dangling.
 */
export function startCampaignRun(campaignId: string): void {
  after(async () => {
    await runCampaign(campaignId);
  });
}
