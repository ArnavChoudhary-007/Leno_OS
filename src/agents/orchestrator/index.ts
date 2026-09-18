/**
 * Orchestrator agent loop:
 *
 *   Understand -> Define goal -> Create plan -> Select agents -> Execute
 *   -> Evaluate -> Iterate -> Deliver
 *
 * Per campaign objective: draft -> platform agent -> critic -> score + feedback.
 * Below PASS_THRESHOLD (see agents/critic): revise and re-score, up to
 * MAX_REVISION_ROUNDS times, then escalate to a human (status
 * 'needs_human'). At/above threshold: mark ready and stop.
 *
 * Hard rule: this function (and everything it calls) must never publish
 * anything. Only plain, deterministic code (tools/social/*) publishes,
 * and only after a human approves a draft.
 *
 * TODO: implement the loop described above, wiring together
 * agents/brand, agents/research, agents/strategy, agents/platforms,
 * and agents/critic against a campaign row in the db.
 */
export async function runCampaign(campaignId: string): Promise<void> {
  void campaignId;
  throw new Error("runCampaign() is not implemented yet");
}
