/**
 * Preload for CLI scripts (campaign:test, db:seed, …).
 * Next.js loads `.env` itself; plain `node`/`tsx` do not — and Node's
 * `--env-file` also refuses to overwrite vars already set in the shell
 * (including empty strings), which silently breaks local runs.
 *
 * Usage: node --import ./scripts/load-env.mjs --import tsx scripts/….ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");

let raw = "";
try {
  raw = readFileSync(envPath, "utf8");
} catch {
  // No .env — leave process.env as-is (CI / production injects vars).
}

for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;

  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;

  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  process.env[key] = value;
}
