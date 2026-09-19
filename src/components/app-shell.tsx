import type { ReactNode } from "react";
import { AppChrome, type ShellNav } from "@/components/app-chrome";
import type { ChromeNotification } from "@/components/notifications";
import { workspaceCampaignStats } from "@/db/queries/campaigns";
import { listWorkspaceLatestDrafts, workspaceDraftStats } from "@/db/queries/drafts";
import type { WorkspaceRole } from "@/shared/types";

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
  const [stats, campaignStats, latest] = await Promise.all([
    workspaceDraftStats(workspaceId),
    workspaceCampaignStats(workspaceId),
    listWorkspaceLatestDrafts(workspaceId, 8),
  ]);

  const notifications: ChromeNotification[] = [];
  if (stats.review > 0) {
    notifications.push({
      id: "review",
      title: `${stats.review} posts waiting for review`,
      detail: "Attention required",
      tone: "amber",
      href: "/campaigns?status=Review",
    });
  }
  if (campaignStats.running > 0) {
    notifications.push({
      id: "running",
      title: "Orchestrator is generating drafts",
      detail: `${campaignStats.running} campaign${campaignStats.running === 1 ? "" : "s"} in flight`,
      tone: "blue",
      href: "/track",
    });
  }
  const published = latest.find((d) => d.status === "published");
  if (published) {
    notifications.push({
      id: "published",
      title: "A post went live",
      detail: published.body.slice(0, 72),
      tone: "green",
      href: `/campaigns/${published.campaign_id}`,
    });
  }

  return (
    <AppChrome
      email={email}
      role={role}
      canMutate={canMutate}
      current={current}
      reviewCount={stats.review}
      agentCount={campaignStats.running > 0 ? 3 : 4}
      notifications={notifications.slice(0, 4)}
    >
      {children}
    </AppChrome>
  );
}
