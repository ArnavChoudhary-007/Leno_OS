import { getBrandProfile } from "@/db/queries/brand";
import type { BrandProfile } from "@/shared/types";

export { buildBrandCard, estimateTokens } from "@/shared/brand-card";

/**
 * Loads the company context (brand profile) shared by every agent's
 * prompt. Throws if none has been set up yet — every agent needs a real
 * brand to write against.
 */
export async function getCompanyContext(
  workspaceId: string,
): Promise<BrandProfile> {
  const profile = await getBrandProfile(workspaceId);
  if (!profile) {
    throw new Error("No brand profile yet — set one up at /brand");
  }
  return profile;
}
