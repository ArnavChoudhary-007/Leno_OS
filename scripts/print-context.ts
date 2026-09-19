/**
 * Prints the brand card exactly as agents will see it, plus its token
 * estimate. Useful for eyeballing prompt size while editing the brand
 * profile. Run with: npm run context:print
 */
import { client } from "@/db/client";
import { buildBrandCard, estimateTokens, getCompanyContext } from "@/memory/context";
import {
  getWorkspaceBySlug,
  LOCAL_WORKSPACE_SLUG,
} from "@/db/queries/workspaces";

async function main() {
  const workspace = await getWorkspaceBySlug(LOCAL_WORKSPACE_SLUG);
  if (!workspace) {
    throw new Error(`Workspace "${LOCAL_WORKSPACE_SLUG}" is missing.`);
  }
  const profile = await getCompanyContext(workspace.id);
  const card = buildBrandCard(profile);

  console.log(card);
  console.log(
    `\n--- ~${estimateTokens(card)} tokens (${card.length} chars) ---`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
