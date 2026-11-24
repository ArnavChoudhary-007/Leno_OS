import { countLlmCall, getCampaign } from "@/db/queries/campaigns";
import { claimDraftRevision, finishDraftRevision, releaseDraftRevision, type DraftRow } from "@/db/queries/drafts";
import { getLatestStepOutput, logStep } from "@/db/queries/runs";
import { buildBrandCard, getCompanyContext } from "@/memory/context";
import { AppError } from "@/shared/errors";
import { CampaignOptionsSchema, StrategySchema } from "@/shared/schemas";
import type { Critique, Draft, PlatformId, Strategy } from "@/shared/types";
import { withModelContext } from "@/tools/run-context";
import { critique, PASS_THRESHOLD } from "../critic";
import { reviseDrafts } from "../platforms/draft";

export type NoteRevisionResult = { before: DraftRow; after: DraftRow; critique: Critique };

export async function reviseWithNote(draftId: string, note: string, opts?: { threshold?: number }): Promise<NoteRevisionResult> {
  const { draft: before, token } = await claimDraftRevision(draftId);
  try {
    const campaign = await getCampaign(before.campaign_id);
    if (!campaign?.plan) throw new AppError("conflict", "This campaign has no plan to revise against.");
    const platform = before.platform as PlatformId;
    const plan = { ...campaign.plan, platforms: [platform] };
    const brandCard = campaign.brand_snapshot ?? buildBrandCard(await getCompanyContext(campaign.workspace_id));
    const strategy = await loadStrategy(before.campaign_id);
    const options = CampaignOptionsSchema.parse(campaign.options ?? {});
    return await withModelContext({ options, signal: AbortSignal.timeout(4 * 60_000), maxAttempts: 6,
      onAttempt: () => countLlmCall(campaign.id) }, async () => {
      const asCritique: Critique = {
        platform, scores: before.scores ?? { brand_voice: 0, goal_fit: 0, platform_fit: 0, craft: 0 },
        fix_list: [note, ...(before.critic_notes?.fix_list ?? [])], rationale: "A human asked for this change.",
        weighted: before.score ?? 0, gate_failures: [], pass: false,
      };
      const asDraft: Draft = { platform, body: before.body, hashtags: before.hashtags };
      const revised = await reviseDrafts([{ draft: asDraft, critique: asCritique }], plan, strategy, brandCard);
      const newDraft = revised.object[0];
      if (!newDraft) throw new AppError("job_failed", "The writer returned no revision.");
      await logStep(campaign.id, "iterate", "revise", revised.model, { source: "human", note, drafts: revised.object }, revised.ms);
      const scored = await critique([newDraft], plan, brandCard, opts?.threshold ?? PASS_THRESHOLD);
      const verdict = scored.object[0];
      if (!verdict) throw new AppError("job_failed", "The critic returned no verdict.");
      await logStep(campaign.id, "evaluate", "critique", scored.model, { source: "human", critiques: scored.object }, scored.ms);
      const after = await finishDraftRevision(draftId, token, { workspace_id: before.workspace_id, campaign_id: campaign.id,
        platform, body: newDraft.body, hashtags: newDraft.hashtags, image_url: before.image_url, review_note: note }, verdict, note);
      return { before, after, critique: verdict };
    });
  } finally {
    await releaseDraftRevision(draftId, token);
  }
}

async function loadStrategy(campaignId: string): Promise<Strategy> {
  const parsed = StrategySchema.safeParse(await getLatestStepOutput(campaignId, "strategy"));
  if (!parsed.success) throw new AppError("conflict", "This campaign has no usable strategy. Rerun it before revising.");
  return parsed.data;
}
