import "server-only";
import { isPublicDemo } from "@/auth/public-demo";
import { can } from "@/authz/can";
import type { PublishAccess } from "@/components/leno/post-actions";
import type { WorkspaceRole } from "@/shared/types";
import { blueskyConfigured } from "@/tools/social/bluesky";
import { linkedinConnected } from "@/tools/social/linkedin";

/** Can this person publish or schedule, and which channels are connected. */
export async function publishAccess(
  workspaceId: string,
  role: WorkspaceRole,
): Promise<PublishAccess> {
  const destinations = {
    bluesky: blueskyConfigured(),
    linkedin: await linkedinConnected(workspaceId),
  };
  if (isPublicDemo()) {
    return {
      allowed: false,
      reason: "Publishing and scheduling are turned off in this public demo.",
      destinations,
    };
  }
  if (!can(role, "publish")) {
    return { allowed: false, reason: "Viewers can’t publish or schedule.", destinations };
  }
  return { allowed: true, destinations };
}
