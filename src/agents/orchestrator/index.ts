import {
  claimCampaign,
  getCampaign,
  saveCampaignPlan,
  updateCampaignStatus,
} from "@/db/queries/campaigns";
import {
  insertDrafts,
  updateDraftCritique,
  updateDraftStatus,
  type DraftRow,
} from "@/db/queries/drafts";
import { logStep } from "@/db/queries/runs";
import { buildBrandCard, getCompanyContext } from "@/memory/context";
import type { Critique, Draft, Plan, PlatformId, Strategy } from "@/shared/types";
import { critique, MAX_REVISION_ROUNDS, PASS_THRESHOLD } from "../critic";
import { draftAll, reviseDrafts } from "../platforms/draft";
import { strategy as buildStrategy } from "../strategy";
import { plan as buildPlan } from "./plan";

/** One platform's current state inside a run. */
type Slot = {
  draftId: string;
  version: number;
  draft: Draft;
  critique: Critique;
};

/** Look up insert results by platform — never by array index. */
function rowsByPlatform(rows: DraftRow[]): Map<PlatformId, DraftRow> {
  const map = new Map<PlatformId, DraftRow>();
  for (const row of rows) {
    map.set(row.platform as PlatformId, row);
  }
  return map;
}

function critiquesByPlatform(critiques: Critique[]): Map<PlatformId, Critique> {
  const map = new Map<PlatformId, Critique>();
  for (const c of critiques) {
    map.set(c.platform, c);
  }
  return map;
}

/**
 * Orchestrator loop:
 *
 *   plan -> strategy -> draftAll -> critique -> [revise -> critique] x3 -> done
 *
 * Four LLM calls minimum, ten maximum — never one call per platform.
 * Drafts that still fail after the last round are handed to a human.
 *
 * Hard rule: nothing in here publishes. Publishing is deterministic code
 * (tools/social/*) run only after a human approves a draft.
 *
 * This never throws: failures are recorded as an "error" run step and the
 * campaign is marked failed, because it runs detached in after().
 */
export async function runCampaign(
  campaignId: string,
  opts?: { threshold?: number },
): Promise<void> {
  const threshold = opts?.threshold ?? PASS_THRESHOLD;

  try {
    // Claims queued campaigns, or reclaims ones stuck in `running` past the
    // stale window (process crash). Active runs and finished ones are no-ops.
    const claimed = await claimCampaign(campaignId);
    if (!claimed) return;

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const brandCard = buildBrandCard(
      await getCompanyContext(campaign.workspace_id),
    );

    // 1. Plan
    const planned = await runStep(campaignId, "plan", () =>
      buildPlan(campaign.brief, brandCard),
    );
    const plan: Plan = planned.object;
    await saveCampaignPlan(campaignId, plan);

    // 2. Strategy
    const strategised = await runStep(campaignId, "strategy", () =>
      buildStrategy(plan, brandCard),
    );
    const strategy: Strategy = strategised.object;

    // 3. Draft every platform in one call
    const drafted = await runStep(campaignId, "draft", () =>
      draftAll(plan, strategy, brandCard),
    );
    if (drafted.object.length === 0) {
      throw new Error("The writer returned no drafts");
    }

    const rows = await insertDrafts(
      drafted.object.map((draft) => ({
        workspace_id: campaign.workspace_id,
        campaign_id: campaignId,
        platform: draft.platform,
        version: 1,
        body: draft.body,
        hashtags: draft.hashtags,
      })),
    );

    // 4. Critique every draft in one call
    const critiqued = await runStep(campaignId, "critique", () =>
      critique(drafted.object, plan, brandCard, threshold),
    );

    const rowMap = rowsByPlatform(rows);
    const critiqueMap = critiquesByPlatform(critiqued.object);
    const slots = new Map<string, Slot>();
    for (const draft of drafted.object) {
      const row = rowMap.get(draft.platform);
      const verdict = critiqueMap.get(draft.platform);
      if (!row) {
        throw new Error(`No DB row returned for platform ${draft.platform}`);
      }
      if (!verdict) {
        throw new Error(`No critique returned for platform ${draft.platform}`);
      }
      slots.set(draft.platform, {
        draftId: row.id,
        version: row.version,
        draft,
        critique: verdict,
      });
      await updateDraftCritique(row.id, verdict, "draft");
    }

    // 5. Revision rounds
    for (let round = 1; round <= MAX_REVISION_ROUNDS; round++) {
      const failing = [...slots.values()].filter((s) => !s.critique.pass);
      if (failing.length === 0) break;

      const revised = await runStep(campaignId, "revise", () =>
        reviseDrafts(
          failing.map((s) => ({ draft: s.draft, critique: s.critique })),
          plan,
          strategy,
          brandCard,
        ),
      );
      if (revised.object.length === 0) break;

      const newRows = await insertDrafts(
        revised.object.map((draft) => ({
          workspace_id: campaign.workspace_id,
          campaign_id: campaignId,
          platform: draft.platform,
          version: (slots.get(draft.platform)?.version ?? 1) + 1,
          body: draft.body,
          hashtags: draft.hashtags,
        })),
      );

      // Only the new versions get re-scored.
      const rescored = await runStep(campaignId, "critique", () =>
        critique(revised.object, plan, brandCard, threshold),
      );

      const newRowMap = rowsByPlatform(newRows);
      const rescoreMap = critiquesByPlatform(rescored.object);
      for (const draft of revised.object) {
        const row = newRowMap.get(draft.platform);
        const verdict = rescoreMap.get(draft.platform);
        if (!row) {
          throw new Error(`No DB row returned for revised ${draft.platform}`);
        }
        if (!verdict) {
          throw new Error(`No critique returned for revised ${draft.platform}`);
        }
        slots.set(draft.platform, {
          draftId: row.id,
          version: row.version,
          draft,
          critique: verdict,
        });
        await updateDraftCritique(row.id, verdict, "draft");
      }
    }

    // 6. Anything still failing is a human's problem now.
    let needsHuman = false;
    for (const slot of slots.values()) {
      if (!slot.critique.pass) {
        needsHuman = true;
        await updateDraftStatus(slot.draftId, "needs_human");
      }
    }

    await updateCampaignStatus(campaignId, needsHuman ? "needs_human" : "ready");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await logStep(campaignId, "error", "-", { message }, 0);
      await updateCampaignStatus(campaignId, "failed");
    } catch (logErr) {
      console.error(`[orchestrator] could not record failure:`, logErr);
    }
    console.error(`[orchestrator] campaign ${campaignId} failed:`, message);
  }
}

/** Runs one agent call and writes its run_steps row. */
async function runStep<T>(
  campaignId: string,
  step: "plan" | "strategy" | "draft" | "critique" | "revise",
  call: () => Promise<{ object: T; model: string; ms: number }>,
): Promise<{ object: T; model: string; ms: number }> {
  const result = await call();
  await logStep(campaignId, step, result.model, result.object, result.ms);
  return result;
}
