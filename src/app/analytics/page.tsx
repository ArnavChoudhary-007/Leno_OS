import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import { listWorkspaceDraftAnalytics } from "@/db/queries/drafts";
import { AnalyticsView } from "./analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const posts = await listWorkspaceDraftAnalytics(ctx.workspaceId);
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
          published_at: post.published_at,
          platform: post.platform,
          status: post.status,
          title: post.title ?? "Campaign post",
        }))}
      />
    </AppShell>
  );
}
