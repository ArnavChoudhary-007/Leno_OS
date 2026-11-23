import type { ReactNode } from "react";
import { AppChrome, type PaletteEntry, type ShellNav } from "@/components/app-chrome";
import type { ChromeNotification } from "@/components/notifications";
import { workspaceCampaignStats } from "@/db/queries/campaigns";
import { listWorkspaceLatestDrafts, workspaceDraftStats } from "@/db/queries/drafts";
import { getWorkspaceById } from "@/db/queries/workspaces";
import { isPublicDemo } from "@/auth/public-demo";
import { platformLabel, postTitle } from "@/lib/workspace-ui";
import type { WorkspaceRole } from "@/shared/types";

/**
 * Server half of the app frame: loads the counts, notifications and
 * searchable posts the sidebar, top bar and command palette show.
 */
export async function AppShell({
  children,
  email,
  role,
  canMutate,
  current,
  workspaceId,
}: {
  children: ReactNode;
  email: string | null;
  role: WorkspaceRole;
  canMutate: boolean;
  current: ShellNav;
  workspaceId: string;
}) {
  const [stats, campaignStats, latest, workspace] = await Promise.all([
    workspaceDraftStats(workspaceId),
    workspaceCampaignStats(workspaceId),
    listWorkspaceLatestDrafts(workspaceId, 40),
    getWorkspaceById(workspaceId),
  ]);

  const notifications: ChromeNotification[] = [];
  if (stats.review > 0) {
    notifications.push({
      id: `review-${stats.review}`,
      title: `${stats.review} post${stats.review === 1 ? " is" : "s are"} waiting for your approval`,
      at: latest.find((d) => d.status === "draft" || d.status === "needs_human")?.created_at ?? null,
      href: "/campaigns?status=Waiting",
      unread: true,
    });
  }
  if (campaignStats.running > 0) {
    notifications.push({
      id: `running-${campaignStats.running}`,
      title: `Agents are writing ${campaignStats.running === 1 ? "a campaign" : `${campaignStats.running} campaigns`} right now`,
      at: null,
      href: "/track",
      unread: true,
    });
  }
  for (const draft of latest.filter((d) => d.status === "published").slice(0, 2)) {
    notifications.push({
      id: `published-${draft.id}`,
      title: `“${postTitle(draft).slice(0, 60)}” went live on ${platformLabel(draft.platform)}`,
      at: draft.created_at,
      href: `/campaigns/${draft.campaign_id}`,
      unread: false,
    });
  }

  const posts: PaletteEntry[] = latest.slice(0, 24).map((draft) => ({
    label: postTitle(draft),
    kind: `${platformLabel(draft.platform)} post`,
    href: `/track?post=${draft.id}`,
  }));

  return (
    <AppChrome
      email={email}
      role={role}
      canMutate={canMutate}
      current={current}
      workspaceName={workspace?.name ?? "Workspace"}
      reviewCount={stats.review}
      runningCount={campaignStats.running}
      notifications={notifications.slice(0, 5)}
      posts={posts}
      canSignOut={!isPublicDemo()}
    >
      {children}
    </AppChrome>
  );
}
