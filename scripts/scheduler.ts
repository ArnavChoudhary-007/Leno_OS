import { setTimeout } from "node:timers/promises";
import { client } from "../src/db/client";
import { publishDueDrafts } from "../src/workflows/scheduled-publish";
import { recoverStuckRuns } from "../src/agents/orchestrator/recover";

const shutdown = new AbortController();
process.once("SIGINT", () => shutdown.abort());
process.once("SIGTERM", () => shutdown.abort());

async function main() {
  try {
    while (!shutdown.signal.aborted) {
      try {
        await recoverStuckRuns();
        await publishDueDrafts(shutdown.signal);
      } catch (err) {
        console.error("[scheduler] Tick failed:", err);
      }
      await setTimeout(30_000, undefined, { signal: shutdown.signal }).catch(() => undefined);
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => { console.error("[scheduler] Fatal error:", err); process.exitCode = 1; });
