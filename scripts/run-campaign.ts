/**
 * Runs one campaign end to end, synchronously, and prints what happened.
 *
 *   npm run campaign:test
 *   npm run campaign:test -- --threshold=0.95            # force revisions
 *   npm run campaign:test -- --brief="Launch the..."
 *   npm run campaign:test -- --image=./photo.jpg
 *   npm run campaign:test -- --note-revise=linkedin      # then a human note
 */
import { readFile } from "node:fs/promises";
import { MAX_LLM_CALLS, runCampaign } from "@/agents/orchestrator";
import { reviseWithNote } from "@/agents/orchestrator/revise-with-note";
import { PLATFORM_PLAYBOOKS } from "@/agents/platforms";
import { saveOriginalImage } from "@/creative/storage";
import { client } from "@/db/client";
import { getBrandProfile } from "@/db/queries/brand";
import { getCampaign, insertCampaign } from "@/db/queries/campaigns";
import {
  getCurrentDraftForPlatform,
  getDraftsForCampaign,
  getDraftsForPlatform,
} from "@/db/queries/drafts";
import { getRunSteps } from "@/db/queries/runs";
import {
  getWorkspaceBySlug,
  LOCAL_WORKSPACE_SLUG,
} from "@/db/queries/workspaces";
import type { CampaignSummary, PlatformId } from "@/shared/types";

const SAMPLE_BRIEF =
  "We are launching the Aero Case Pro, a charging case that adds 30 hours of battery to our earbuds. Launch week is next week. We want people who already own Aero earbuds to buy the case, and we want new buyers to see it as the reason to pick us. Keep it grounded — no spec-sheet bragging.";

const SAMPLE_NOTE =
  "Cut the opening question and lead with the 30-hour number instead. Keep it to two short paragraphs.";

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function pad(value: string, width: number): string {
  return value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);
}

function rule(width = 72) {
  console.log("-".repeat(width));
}

async function main() {
  const thresholdArg = arg("threshold");
  const threshold = thresholdArg ? Number(thresholdArg) : undefined;
  if (thresholdArg && (Number.isNaN(threshold!) || threshold! < 0 || threshold! > 1)) {
    throw new Error(`--threshold must be between 0 and 1, got "${thresholdArg}"`);
  }

  const brief = arg("brief") ?? SAMPLE_BRIEF;
  const notePlatform = arg("note-revise") as PlatformId | undefined;
  if (notePlatform && !PLATFORM_PLAYBOOKS[notePlatform]) {
    throw new Error(`--note-revise must name a platform, got "${notePlatform}"`);
  }

  console.log(`Brief: ${brief}`);
  if (threshold !== undefined) console.log(`Pass threshold: ${threshold}`);
  console.log();

  const workspace = await getWorkspaceBySlug(LOCAL_WORKSPACE_SLUG);
  if (!workspace) {
    throw new Error(`Workspace "${LOCAL_WORKSPACE_SLUG}" is missing.`);
  }
  const brand = await getBrandProfile(workspace.id);

  const campaign = await insertCampaign({
    workspaceId: workspace.id,
    createdBy: "cli",
    brief,
    brandId: brand?.id ?? null,
  });
  const imagePath = arg("image");
  if (imagePath) {
    const bytes = await readFile(imagePath);
    await saveOriginalImage(workspace.id, campaign.id, bytes);
    console.log(`Image: ${imagePath} (will be cropped per platform)\n`);
  }
  console.log(`Campaign ${campaign.id} — running...\n`);

  await runCampaign(campaign.id, threshold !== undefined ? { threshold } : undefined);

  const [finished, steps, allDrafts] = await Promise.all([
    getCampaign(campaign.id),
    getRunSteps(campaign.id),
    getDraftsForCampaign(campaign.id),
  ]);

  // ---- phase timeline ----
  console.log("PHASE TIMELINE");
  console.log(
    `${pad("phase", 14)} ${pad("step", 13)} ${pad("model", 32)} ${"ms".padStart(7)}`,
  );
  rule();
  for (const step of steps) {
    console.log(
      `${pad(step.phase ?? "-", 14)} ${pad(step.step, 13)} ${pad(step.model ?? "(code)", 32)} ${String(step.duration_ms).padStart(7)}`,
    );
  }
  console.log();

  for (const step of steps.filter((s) => s.phase === "error")) {
    console.log(`ERROR: ${JSON.stringify(step.output)}\n`);
  }

  // ---- every version, so escalation choices can be checked ----
  console.log("ALL VERSIONS");
  console.log(
    `${pad("platform", 11)} ${pad("ver", 4)} ${pad("chars/limit", 13)} ${pad("score", 8)} status`,
  );
  rule();
  for (const draft of allDrafts) {
    const limit = PLATFORM_PLAYBOOKS[draft.platform as PlatformId].maxChars;
    console.log(
      `${pad(draft.platform, 11)} ${pad(String(draft.version), 4)} ${pad(`${draft.body.length}/${limit}`, 13)} ${pad(draft.score === null ? "-" : draft.score.toFixed(3), 8)} ${draft.status}`,
    );
  }
  console.log();

  // ---- summary ----
  const summary = finished?.summary as CampaignSummary | null;
  if (summary) {
    console.log("SUMMARY");
    console.log(
      `${pad("platform", 11)} ${pad("ver", 4)} ${pad("score", 8)} ${pad("pass", 6)} ${pad("rounds", 7)} status`,
    );
    rule();
    for (const row of summary.platforms) {
      console.log(
        `${pad(row.platform, 11)} ${pad(String(row.version), 4)} ${pad(row.score === null ? "-" : row.score.toFixed(3), 8)} ${pad(String(row.pass), 6)} ${pad(String(row.rounds_used), 7)} ${row.status}`,
      );
    }
    console.log(
      `\nllm_calls: ${summary.totals.llm_calls}/${MAX_LLM_CALLS} · ${(summary.totals.duration_ms / 1000).toFixed(1)}s · models: ${summary.totals.models_used.join(", ") || "(none)"}`,
    );
  } else {
    console.log("SUMMARY: none — the run produced nothing usable.");
  }

  console.log(`\nCampaign status: ${finished?.status}`);

  // ---- optional human-note revision ----
  if (notePlatform) {
    const current = await getCurrentDraftForPlatform(campaign.id, notePlatform);
    if (!current) {
      console.log(`\nNo current ${notePlatform} draft to revise.`);
      return;
    }

    console.log(`\n${"=".repeat(72)}`);
    console.log(`HUMAN NOTE REVISION — ${notePlatform}`);
    console.log(`Note: ${SAMPLE_NOTE}\n`);

    console.log(`BEFORE (v${current.version}, score ${current.score?.toFixed(3) ?? "-"}, ${current.status}):`);
    console.log(current.body);

    const result = await reviseWithNote(current.id, SAMPLE_NOTE, {
      threshold: threshold ?? undefined,
    });

    console.log(
      `\nAFTER (v${result.after.version}, score ${result.after.score?.toFixed(3) ?? "-"}, ${result.after.status}):`,
    );
    console.log(result.after.body);

    const versions = await getDraftsForPlatform(campaign.id, notePlatform);
    console.log(`\n${notePlatform} versions now:`);
    for (const v of versions) {
      console.log(
        `  v${v.version}  ${pad(v.score === null ? "-" : v.score.toFixed(3), 8)} ${v.status}`,
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
