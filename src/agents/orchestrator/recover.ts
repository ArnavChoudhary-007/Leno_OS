import {
  finishCampaign,
  getRunningCampaigns,
} from "@/db/queries/campaigns";
import { getLastStepAt, logStep } from "@/db/queries/runs";

/** A run silent for this long is assumed dead, not slow. */
export const STUCK_AFTER_MS = 5 * 60 * 1000;

const INTERRUPTED = "Interrupted — the server restarted during the run";

/**
 * Marks abandoned runs as failed. A campaign stuck on "running" can never
 * be claimed again (claiming requires "queued"), so without this a server
 * restart mid-run strands it forever. Failed campaigns can be retried.
 *
 * Returns the ids it reclaimed.
 */
export async function recoverStuckRuns(): Promise<string[]> {
  const running = await getRunningCampaigns();
  const now = Date.now();
  const recovered: string[] = [];

  for (const campaign of running) {
    const lastStepAt = await getLastStepAt(campaign.id);
    // Fall back to the claim time for a run that died before its first step.
    const lastSign = lastStepAt ?? campaign.started_at ?? campaign.created_at;
    if (now - new Date(lastSign).getTime() < STUCK_AFTER_MS) continue;

    await logStep(campaign.id, "error", "error", null, { message: INTERRUPTED }, 0);
    await finishCampaign(campaign.id, "failed", campaign.summary);
    recovered.push(campaign.id);
  }

  if (recovered.length > 0) {
    console.warn(
      `[orchestrator] reclaimed ${recovered.length} interrupted run(s): ${recovered.join(", ")}`,
    );
  }
  return recovered;
}
