import { getBrandProfile } from "@/db/queries/brand";
import { getDraftInWorkspace } from "@/db/queries/drafts";
import {
  FALLBACK_BRAND,
  type BrandVisual,
} from "@/creative/templates";
import { isHexColor } from "@/creative/colors";

export async function loadBrandVisual(
  workspaceId: string,
): Promise<BrandVisual> {
  const profile = await getBrandProfile(workspaceId);
  if (!profile) return FALLBACK_BRAND;
  return {
    name: profile.name,
    primary: isHexColor(profile.primary_color)
      ? profile.primary_color
      : FALLBACK_BRAND.primary,
    secondary: isHexColor(profile.secondary_color)
      ? profile.secondary_color
      : FALLBACK_BRAND.secondary,
  };
}

export async function loadDraftBody(
  workspaceId: string,
  draftId: string,
): Promise<string | null> {
  const draft = await getDraftInWorkspace(workspaceId, draftId);
  if (!draft) return null;
  return draft.body;
}
