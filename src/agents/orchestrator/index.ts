import {
  claimCampaign,
<<<<<<< HEAD
  getCampaign,
=======
  countLlmCall,
  finishCampaign,
  saveBrandSnapshot,
>>>>>>> origin/main
  saveCampaignPlan,
  updateCampaignStatus,
} from "@/db/queries/campaigns";
import {
  getDraftsForCampaign,
  insertDrafts,
  supersedeOtherVersions,
  updateDraftCritique,
  updateDraftStatus,
  type DraftRow,
} from "@/db/queries/drafts";
import { getModelsUsed, logStep, type RunStepName } from "@/db/queries/runs";
import { buildBrandCard, getCompanyContext } from "@/memory/context";
<<<<<<< HEAD
import type { Critique, Draft, Plan, PlatformId, Strategy } from "@/shared/types";
import { fitCampaignImages } from "@/creative/fit-campaign";
import {
  formatResearchBlock,
  researchForLinkedIn,
  tavilyConfigured,
} from "@/tools/tavily";
import { critique, MAX_REVISION_ROUNDS, PASS_THRESHOLD } from "../critic";
=======
import type {
  CampaignSummary,
  Critique,
  Draft,
  Plan,
  PlatformId,
  RunPhase,
  Strategy,
} from "@/shared/types";
import { critique, MAX_REVISION_ROUNDS, PASS_THRESHOLD } from "../critic";
import { composePost, PLATFORM_PLAYBOOKS } from "../platforms";
>>>>>>> origin/main
import { draftAll, reviseDrafts } from "../platforms/draft";
import { strategy as buildStrategy } from "../strategy";
import { plan as buildPlan } from "./plan";

/** Hard ceilings. A run that hits either stops iterating and delivers. */
export const MAX_LLM_CALLS = 10;
export const MAX_RUN_MS = 4 * 60 * 1000;

/** Agents that exist in the architecture but aren't built yet. */
const UNAVAILABLE_AGENTS: Record<string, string> = {
  research: "not built yet",
};

/** One platform's current state inside a run. */
type Slot = {
  draftId: string;
  version: number;
  draft: Draft;
  critique: Critique;
  roundsUsed: number;
};

type Ctx = {
  campaignId: string;
  startedAt: number;
  calls: number;
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
 * The orchestrator's eight phases:
 *
<<<<<<< HEAD
 *   plan -> strategy -> research (Tavily, LinkedIn only) -> draftAll
 *     -> image (GPT Image 1.5 if no upload)
 *     -> critique -> [revise -> critique] x3 -> done
 *
 * Four LLM calls minimum, ten maximum — never one call per platform.
 * Image generation is a separate OpenAI Images call, not an agent.
 * Tavily research is optional enrichment; a miss never fails the run.
 * Drafts that still fail after the last round are handed to a human.
=======
 *   Understand -> Define goal -> Create plan -> Select agents
 *   -> Execute -> Evaluate -> Iterate -> Deliver
 *
 * Four LLM calls minimum, MAX_LLM_CALLS maximum — never one per platform.
 * Every phase writes a run_steps row, including the code-only ones, so a
 * finished run can be read back start to finish.
>>>>>>> origin/main
 *
 * Hard rule: nothing here publishes. Publishing is deterministic code
 * (tools/social/*) run only after a human approves a draft.
 *
 * This never throws. Once drafts exist the run always delivers something,
 * even if a later call fails; only a run that produced nothing usable is
 * marked failed.
 */
export async function runCampaign(
  campaignId: string,
  opts?: { threshold?: number },
): Promise<void> {
  const threshold = opts?.threshold ?? PASS_THRESHOLD;
  const ctx: Ctx = { campaignId, startedAt: Date.now(), calls: 0 };

  // Claiming is atomic: if this returns null another run already owns it.
  const campaign = await claimCampaign(campaignId);
  if (!campaign) return;

  const slots = new Map<PlatformId, Slot>();
  let plan: Plan | null = null;
  let strategy: Strategy | null = null;

  try {
<<<<<<< HEAD
    // Claims queued campaigns, or reclaims ones stuck in `running` past the
    // stale window (process crash). Active runs and finished ones are no-ops.
    const claimed = await claimCampaign(campaignId);
    if (!claimed) return;

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const brand = await getCompanyContext(campaign.workspace_id);
    const brandCard = buildBrandCard(brand);
=======
    // ---- 1. Understand -------------------------------------------------
    const brandCard = buildBrandCard(await getCompanyContext());
    await saveBrandSnapshot(campaignId, brandCard);
    await code(ctx, "understand", "load_context", {
      brief_chars: campaign.brief.length,
      brand: campaign.brief ? brandCardName(brandCard) : null,
      brand_card_chars: brandCard.length,
    });
>>>>>>> origin/main

    // ---- 2. Define goal + Create plan ----------------------------------
    // One call, logged twice: the goal it settled on, then the whole plan.
    const planned = await llm(ctx, "plan", "plan", () =>
      buildPlan(campaign.brief, brandCard),
    );
    plan = planned.object;
    await saveCampaignPlan(campaignId, plan);
    await logStep(campaignId, "define_goal", "plan", planned.model, plan.goal, 0);

    const strategised = await llm(ctx, "plan", "strategy", () =>
      buildStrategy(plan!, brandCard),
    );
    strategy = strategised.object;

<<<<<<< HEAD
    let researchBlock: string | undefined;
    if (plan.platforms.includes("linkedin") && tavilyConfigured()) {
      const started = Date.now();
      const research = await researchForLinkedIn({
        workspaceId: campaign.workspace_id,
        brandName: brand.name,
        brief: campaign.brief,
        audience: plan.audience,
        keyMessage: plan.key_message,
        angle: strategy.angle,
        competitors: brand.competitors,
      });
      if (research) {
        researchBlock = formatResearchBlock(research);
        await logStep(
          campaignId,
          "research",
          "tavily",
          {
            query: research.query,
            answer: research.answer,
            sources: research.sources.map((source) => ({
              title: source.title,
              url: source.url,
            })),
          },
          Date.now() - started,
          campaign.workspace_id,
        );
      }
    }

    // 3. Draft every platform in one call
    const drafted = await runStep(campaignId, "draft", () =>
      draftAll(plan, strategy, brandCard, researchBlock),
=======
    // ---- 3. Select agents ----------------------------------------------
    const roster: PlatformId[] = [];
    const skipped: string[] = [];
    for (const platform of plan.platforms) {
      if (PLATFORM_PLAYBOOKS[platform]?.enabled) roster.push(platform);
      else skipped.push(`${platform}: disabled`);
    }
    for (const playbook of Object.values(PLATFORM_PLAYBOOKS)) {
      if (!playbook.enabled && !skipped.some((s) => s.startsWith(playbook.id)))
        skipped.push(`${playbook.id}: disabled`);
    }
    for (const [agent, reason] of Object.entries(UNAVAILABLE_AGENTS)) {
      skipped.push(`${agent}: ${reason}`);
    }
    await code(ctx, "select_agents", "roster", { roster, skipped });

    if (roster.length === 0) {
      throw new Error(
        "No enabled platforms to write for — every platform in the plan is disabled.",
      );
    }
    const activePlan: Plan = { ...plan, platforms: roster };

    // ---- 4. Execute ----------------------------------------------------
    const drafted = await llm(ctx, "execute", "draft", () =>
      draftAll(activePlan, strategy!, brandCard),
>>>>>>> origin/main
    );
    if (drafted.object.length === 0) {
      throw new Error("The writer returned no drafts");
    }
<<<<<<< HEAD

    const fitted = await fitCampaignImages(
      campaign.workspace_id,
      campaignId,
      drafted.object.map((d) => d.platform),
      {
        brandName: brand.name,
        oneLiner: brand.one_liner,
        brief: campaign.brief,
        keyMessage: plan.key_message,
        primaryColor: brand.primary_color,
        secondaryColor: brand.secondary_color,
        toneWords: brand.tone_words,
      },
    );
    const imageUrls = fitted.urls;
    if (fitted.generation) {
      await logStep(
        campaignId,
        "image",
        fitted.generation.model,
        { size: fitted.generation.size },
        fitted.generation.ms,
        campaign.workspace_id,
      );
    }

=======
>>>>>>> origin/main
    const rows = await insertDrafts(
      drafted.object.map((draft) => ({
        workspace_id: campaign.workspace_id,
        campaign_id: campaignId,
        platform: draft.platform,
        version: 1,
        body: draft.body,
        hashtags: draft.hashtags,
        image_url: imageUrls[draft.platform] ?? null,
      })),
    );
    const rowFor = byPlatform(rows);

<<<<<<< HEAD
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
          researchBlock,
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
          image_url: imageUrls[draft.platform] ?? null,
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
=======
    // ---- 5. Evaluate ---------------------------------------------------
    try {
      const critiqued = await llm(ctx, "evaluate", "critique", () =>
        critique(drafted.object, activePlan, brandCard, threshold),
      );
      const verdictFor = new Map(
        critiqued.object.map((c) => [c.platform, c] as const),
      );

      for (const draft of drafted.object) {
        const row = rowFor.get(draft.platform);
        const verdict = verdictFor.get(draft.platform);
        if (!row || !verdict) continue;
>>>>>>> origin/main
        slots.set(draft.platform, {
          draftId: row.id,
          version: row.version,
          draft,
          critique: verdict,
          roundsUsed: 0,
        });
        await updateDraftCritique(row.id, verdict, "draft");
      }

      // ---- 6. Iterate --------------------------------------------------
      for (let round = 1; round <= MAX_REVISION_ROUNDS; round++) {
        const failing = [...slots.values()].filter((s) => !s.critique.pass);
        if (failing.length === 0) break;
        if (outOfBudget(ctx)) {
          await code(ctx, "iterate", "summary", {
            stopped: budgetReason(ctx),
            round,
            still_failing: failing.map((f) => f.draft.platform),
          });
          break;
        }

        const revised = await llm(ctx, "iterate", "revise", () =>
          reviseDrafts(
            failing.map((s) => ({ draft: s.draft, critique: s.critique })),
            activePlan,
            strategy!,
            brandCard,
          ),
        );
        if (revised.object.length === 0) break;

        const newRows = await insertDrafts(
          revised.object.map((draft) => ({
            campaign_id: campaignId,
            platform: draft.platform,
            version: (slots.get(draft.platform)?.version ?? 1) + 1,
            body: composePost(draft),
          })),
        );
        const newRowFor = byPlatform(newRows);

        const rescored = await llm(ctx, "evaluate", "critique", () =>
          critique(revised.object, activePlan, brandCard, threshold),
        );
        const rescoredFor = new Map(
          rescored.object.map((c) => [c.platform, c] as const),
        );

        for (const draft of revised.object) {
          const row = newRowFor.get(draft.platform);
          const verdict = rescoredFor.get(draft.platform);
          if (!row || !verdict) continue;
          const previous = slots.get(draft.platform);
          slots.set(draft.platform, {
            draftId: row.id,
            version: row.version,
            draft,
            critique: verdict,
            roundsUsed: (previous?.roundsUsed ?? 0) + 1,
          });
          await updateDraftCritique(row.id, verdict, "draft");
        }
      }
    } catch (err) {
      // Drafts exist, so this is a partial failure, not a dead run.
      await recordError(ctx, err);
    }

    // ---- 7. Deliver ----------------------------------------------------
    await deliver(ctx, slots);
  } catch (err) {
    const drafts = await getDraftsForCampaign(campaignId).catch(() => []);
    await recordError(ctx, err);

    if (drafts.length > 0) {
      // Something usable exists — hand it over rather than binning the run.
      await deliver(ctx, slots).catch(async (deliverErr) => {
        await recordError(ctx, deliverErr);
        await updateCampaignStatus(campaignId, "failed");
      });
    } else {
      await finishCampaign(campaignId, "failed", null);
    }
  }
}

/**
 * Settles every platform on one current version, escalates what didn't
 * pass, and writes the run's summary.
 */
async function deliver(ctx: Ctx, slots: Map<PlatformId, Slot>): Promise<void> {
  const { campaignId } = ctx;
  const allDrafts = await getDraftsForCampaign(campaignId);
  const byPlatformRows = new Map<PlatformId, DraftRow[]>();
  for (const row of allDrafts) {
    const platform = row.platform as PlatformId;
    byPlatformRows.set(platform, [...(byPlatformRows.get(platform) ?? []), row]);
  }

  const platforms: CampaignSummary["platforms"] = [];
  let needsHuman = false;

  for (const [platform, versions] of byPlatformRows) {
    const slot = slots.get(platform);
    const passed = slot?.critique.pass === true;

    // Keep the version that passed; failing platforms keep their best score.
    const kept = passed
      ? (versions.find((v) => v.id === slot?.draftId) ?? bestScoring(versions))
      : bestScoring(versions);
    if (!kept) continue;

    const status = passed ? "draft" : "needs_human";
    if (!passed) needsHuman = true;

    await updateDraftStatus(kept.id, status);
    await supersedeOtherVersions(campaignId, platform, kept.id);

    platforms.push({
      platform,
      draft_id: kept.id,
      version: kept.version,
      score: kept.score,
      pass: passed,
      rounds_used: slot?.roundsUsed ?? Math.max(0, kept.version - 1),
      status,
    });
  }

  platforms.sort((a, b) => a.platform.localeCompare(b.platform));

  const summary: CampaignSummary = {
    platforms,
    totals: {
      llm_calls: ctx.calls,
      duration_ms: Date.now() - ctx.startedAt,
      models_used: await getModelsUsed(campaignId),
    },
  };

  const status = platforms.length === 0 || needsHuman ? "needs_human" : "ready";
  await logStep(campaignId, "deliver", "summary", null, summary, 0);
  await finishCampaign(campaignId, status, summary);
}

/** Highest score wins; an unscored version only wins if nothing else exists. */
function bestScoring(versions: DraftRow[]): DraftRow | undefined {
  return [...versions].sort((a, b) => {
    const diff = (b.score ?? -1) - (a.score ?? -1);
    return diff !== 0 ? diff : b.version - a.version;
  })[0];
}

function byPlatform(rows: DraftRow[]): Map<PlatformId, DraftRow> {
  return new Map(rows.map((row) => [row.platform as PlatformId, row]));
}

function outOfBudget(ctx: Ctx): boolean {
  return (
    ctx.calls >= MAX_LLM_CALLS || Date.now() - ctx.startedAt >= MAX_RUN_MS
  );
}

function budgetReason(ctx: Ctx): string {
  return ctx.calls >= MAX_LLM_CALLS
    ? `LLM call budget spent (${ctx.calls}/${MAX_LLM_CALLS})`
    : `time budget spent (${Math.round((Date.now() - ctx.startedAt) / 1000)}s)`;
}

/** Runs one agent call, counts it against the budget, and logs it. */
async function llm<T>(
  ctx: Ctx,
  phase: RunPhase,
  step: RunStepName,
  call: () => Promise<{ object: T; model: string; ms: number }>,
): Promise<{ object: T; model: string; ms: number }> {
  ctx.calls += 1;
  await countLlmCall(ctx.campaignId);
  const result = await call();
  await logStep(ctx.campaignId, phase, step, result.model, result.object, result.ms);
  return result;
}

/** Logs a phase that is plain code — no model, no budget cost. */
async function code(
  ctx: Ctx,
  phase: RunPhase,
  step: RunStepName,
  output: unknown,
): Promise<void> {
  await logStep(ctx.campaignId, phase, step, null, output, 0);
}

async function recordError(ctx: Ctx, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[orchestrator] campaign ${ctx.campaignId}:`, message);
  try {
    await logStep(ctx.campaignId, "error", "error", null, { message }, 0);
  } catch (logErr) {
    console.error("[orchestrator] could not record failure:", logErr);
  }
}

/** First line of the brand card is "Brand: <name>". */
function brandCardName(brandCard: string): string {
  return brandCard.split("\n")[0]?.replace(/^Brand:\s*/, "") ?? "";
}
