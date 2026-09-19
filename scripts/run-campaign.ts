/**
 * Runs one campaign end to end, synchronously, and prints what happened.
 *
 *   npm run campaign:test
 *   npm run campaign:test -- --threshold=0.95        # force revision rounds
 *   npm run campaign:test -- --brief="Launch the..."
 */
import { runCampaign } from "@/agents/orchestrator";
import { PLATFORM_PLAYBOOKS } from "@/agents/platforms";
import { client } from "@/db/client";
import { getCampaign, insertCampaign } from "@/db/queries/campaigns";
import { getDraftsForCampaign } from "@/db/queries/drafts";
import { getRunSteps } from "@/db/queries/runs";
import type { PlatformId } from "@/shared/types";

const SAMPLE_BRIEF =
  "We are launching the Aero Case Pro, a charging case that adds 30 hours of battery to our earbuds. Launch week is next week. We want people who already own Aero earbuds to buy the case, and we want new buyers to see it as the reason to pick us. Keep it grounded — no spec-sheet bragging.";

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function pad(value: string, width: number): string {
  return value.length > width
    ? `${value.slice(0, width - 1)}…`
    : value.padEnd(width);
}

async function main() {
  const thresholdArg = arg("threshold");
  const threshold = thresholdArg ? Number(thresholdArg) : undefined;
  if (thresholdArg && (Number.isNaN(threshold!) || threshold! < 0 || threshold! > 1)) {
    throw new Error(`--threshold must be between 0 and 1, got "${thresholdArg}"`);
  }

  const brief = arg("brief") ?? SAMPLE_BRIEF;

  console.log(`Brief: ${brief}\n`);
  if (threshold !== undefined) console.log(`Pass threshold: ${threshold}\n`);

  const campaign = await insertCampaign(brief);
  console.log(`Campaign ${campaign.id} — running...\n`);

  const started = Date.now();
  await runCampaign(campaign.id, threshold !== undefined ? { threshold } : undefined);
  const totalMs = Date.now() - started;

  const [finished, steps, drafts] = await Promise.all([
    getCampaign(campaign.id),
    getRunSteps(campaign.id),
    getDraftsForCampaign(campaign.id),
  ]);

  console.log("STEPS");
  console.log(`${pad("step", 10)} ${pad("model", 34)} ${"ms".padStart(7)}`);
  console.log("-".repeat(54));
  for (const step of steps) {
    console.log(
      `${pad(step.step, 10)} ${pad(step.model, 34)} ${String(step.duration_ms).padStart(7)}`,
    );
  }
  const llmCalls = steps.filter((s) => s.step !== "error").length;
  console.log(`\n${llmCalls} LLM calls, ${(totalMs / 1000).toFixed(1)}s total\n`);

  for (const step of steps.filter((s) => s.step === "error")) {
    console.log(`ERROR: ${JSON.stringify(step.output)}\n`);
  }

  console.log("DRAFTS");
  console.log(
    `${pad("platform", 10)} ${pad("ver", 4)} ${pad("chars/limit", 13)} ${pad("weighted", 9)} ${pad("pass", 5)} status`,
  );
  console.log("-".repeat(60));
  for (const draft of drafts) {
    const limit = PLATFORM_PLAYBOOKS[draft.platform as PlatformId].maxChars;
    const chars = draft.body.length;
    const score = draft.score;
    console.log(
      `${pad(draft.platform, 10)} ${pad(String(draft.version), 4)} ${pad(`${chars}/${limit}`, 13)} ${pad(score === null ? "-" : score.toFixed(3), 9)} ${pad(score === null ? "-" : String(score >= (threshold ?? 0.8)), 5)} ${draft.status}`,
    );
  }

  console.log(`\nCampaign status: ${finished?.status}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
