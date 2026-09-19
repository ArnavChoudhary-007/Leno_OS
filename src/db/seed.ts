/**
 * Inserts one demo brand profile so the app has data to render against
 * before any real campaign exists. Loopwave Audio is a fictional company
 * invented for this project — it is not a real brand.
 *
 * Run with: npm run db:seed
 * Refuses to overwrite an existing brand unless ALLOW_DEMO_SEED=1.
 * Refuses in production unless ALLOW_DEMO_SEED=1.
 */
import { client } from "./client";
import { demoBrand } from "./demo-brand";
import { getBrandProfile, upsertBrandProfile } from "./queries/brand";
import {
  getWorkspaceBySlug,
  LOCAL_WORKSPACE_SLUG,
} from "./queries/workspaces";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to seed in production (set ALLOW_DEMO_SEED=1 to override).");
  }

  const workspace = await getWorkspaceBySlug(LOCAL_WORKSPACE_SLUG);
  if (!workspace) {
    throw new Error(
      `Workspace "${LOCAL_WORKSPACE_SLUG}" is missing. Apply migration 0004 first.`,
    );
  }

  const existing = await getBrandProfile(workspace.id);
  if (existing && process.env.ALLOW_DEMO_SEED !== "1") {
    console.log(`Brand already exists for ${workspace.slug}; skip (ALLOW_DEMO_SEED=1 to overwrite).`);
    return;
  }

  await upsertBrandProfile(workspace.id, demoBrand);
  console.log("Seeded demo brand: Loopwave Audio");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
