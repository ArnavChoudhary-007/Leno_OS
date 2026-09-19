import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import { listWorkspaceLatestDrafts } from "@/db/queries/drafts";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const posts = await listWorkspaceLatestDrafts(ctx.workspaceId);
  const canMutate = can(ctx.role, "mutate");

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="analytics"
      workspaceId={ctx.workspaceId}
    >
      <AnalyticsView
        rows={posts.map((post) => ({
          created_at: post.created_at,
          platform: post.platform,
          status: post.status,
          title: post.campaign_goal ?? post.body,
        }))}
      />
    </AppShell>
  );
}
