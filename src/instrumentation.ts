/**
 * Runs once when the server boots. Any campaign left mid-run by the
 * previous process is reclaimed here, so a restart doesn't strand it on
 * "running" forever.
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
}
