/**
 * Runs once when the server boots. Any campaign left mid-run by the
 * previous process is reclaimed here, so a restart doesn't strand it on
 * "running" forever. It also starts the scheduled publisher, which posts
 * approved drafts when their scheduled time arrives (off in the public
 * demo, where publishing is blocked).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.SKIP_ENV_VALIDATION === "1") return;

  const { recoverStuckRuns } = await import("@/agents/orchestrator/recover");
  try {
    await recoverStuckRuns();
  } catch (err) {
    console.error("[instrumentation] stuck-run recovery failed:", err);
  }

  if (process.env.PUBLIC_DEMO !== "1") {
    const { startScheduledPublisher } = await import("@/workflows/publish-scheduled");
    startScheduledPublisher();
  }
}
