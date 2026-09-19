import { countLlmCall, getCampaign } from "@/db/queries/campaigns";
import {
  getDraft,
  insertDrafts,
  saveReviewNote,
  supersedeOtherVersions,
  updateDraftCritique,
  type DraftRow,
} from "@/db/queries/drafts";
import { getLatestStepOutput, logStep } from "@/db/queries/runs";
import { buildBrandCard, getCompanyContext } from "@/memory/context";
import { StrategySchema } from "@/shared/schemas";
import type { Critique, Draft, PlatformId, Strategy } from "@/shared/types";
import { critique, PASS_THRESHOLD } from "../critic";
import { composePost } from "../platforms";
import { reviseDrafts } from "../platforms/draft";

export type NoteRevisionResult = {
  before: DraftRow;
  after: DraftRow;
  critique: Critique;
};

/**
 * Revises one platform's current post against a human's note. The note
 * goes to the front of the fix list, so it outranks whatever the critic
 * had to say.
 *
 * Costs two LLM calls and counts toward the campaign's total, but not
 * toward the automatic revision rounds — a person asking for a change
 * isn't the loop failing to converge.
 */
export async function reviseWithNote(
  draftId: string,
  note: string,
  opts?: { threshold?: number },
): Promise<NoteRevisionResult> {
  const threshold = opts?.threshold ?? PASS_THRESHOLD;

  const before = await getDraft(draftId);
  if (!before) throw new Error(`Draft ${draftId} not found`);
  if (before.status === "superseded") {
    throw new Error("That draft has already been replaced by a newer version");
  }

  const campaign = await getCampaign(before.campaign_id);
  if (!campaign) throw new Error(`Campaign ${before.campaign_id} not found`);
  if (!campaign.plan) {
    throw new Error("This campaign has no plan to revise against");
  }

  const platform = before.platform as PlatformId;
  const plan = { ...campaign.plan, platforms: [platform] };
  const brandCard =
    campaign.brand_snapshot ?? buildBrandCard(await getCompanyContext());
  const strategy = await loadStrategy(before.campaign_id);

  await saveReviewNote(draftId, note);

  // The note leads; the critic's outstanding notes follow it.
  const asCritique: Critique = {
    platform,
    scores: before.scores ?? {
      brand_voice: 0,
      goal_fit: 0,
      platform_fit: 0,
      craft: 0,
    },
    fix_list: [note, ...(before.critic_notes ?? [])],
    rationale: "A human asked for this change.",
    weighted: before.score ?? 0,
    gate_failures: [],
    pass: false,
  };

  const asDraft: Draft = {
    platform,
    body: before.body,
    hashtags: [],
  };

  await countLlmCall(before.campaign_id);
  const revised = await reviseDrafts(
    [{ draft: asDraft, critique: asCritique }],
    plan,
    strategy,
    brandCard,
  );
  const newDraft = revised.object[0];
  if (!newDraft) throw new Error("The writer returned no revision");

  await logStep(
    before.campaign_id,
    "iterate",
    "revise",
    revised.model,
    { source: "human", note, drafts: revised.object },
    revised.ms,
  );

  const [after] = await insertDrafts([
    {
      campaign_id: before.campaign_id,
      platform,
      version: before.version + 1,
      body: composePost(newDraft),
      review_note: note,
    },
  ]);

  await countLlmCall(before.campaign_id);
  const scored = await critique([newDraft], plan, brandCard, threshold);
  const verdict = scored.object[0];

  await logStep(
    before.campaign_id,
    "evaluate",
    "critique",
    scored.model,
    { source: "human", critiques: scored.object },
    scored.ms,
  );

  await updateDraftCritique(
    after.id,
    verdict,
    verdict.pass ? "draft" : "needs_human",
  );
  await supersedeOtherVersions(before.campaign_id, platform, after.id);

  const updated = await getDraft(after.id);
  return { before, after: updated ?? after, critique: verdict };
}

/**
 * The strategy isn't stored on the campaign — it lives in the run log, so
 * a revision weeks later still writes to the same creative direction.
 */
async function loadStrategy(campaignId: string): Promise<Strategy> {
  const output = await getLatestStepOutput(campaignId, "strategy");
  const parsed = StrategySchema.safeParse(output);
  if (!parsed.success) {
    throw new Error(
      "This campaign has no usable strategy on record — rerun it before revising.",
    );
  }
  return parsed.data;
}
