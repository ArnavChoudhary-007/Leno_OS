import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { listWorkspaceLatestDrafts } from "@/db/queries/drafts";
import { listWorkspaceRunSteps } from "@/db/queries/runs";
import { TrackBoard } from "./track-board";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TrackPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const canMutate = can(ctx.role, "mutate");
  const [posts, steps] = await Promise.all([
    listWorkspaceLatestDrafts(ctx.workspaceId),
    listWorkspaceRunSteps(ctx.workspaceId),
  ]);

  const stepsByCampaign: Record<
    string,
    { step: string; created_at: string; duration_ms: number }[]
  > = {};
  for (const step of steps) {
    stepsByCampaign[step.campaign_id] ??= [];
    stepsByCampaign[step.campaign_id].push({
      step: step.step,
      created_at: step.created_at,
      duration_ms: step.duration_ms,
    });
  }

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="track"
      workspaceId={ctx.workspaceId}
    >
      <div className="track-page-container">
        <div className="track-header">
          <div>
            <h2 className="track-title">Content Tracking</h2>
            <p className="track-subtitle">
              Monitor every piece of content from agent ideation to live delivery.
            </p>
          </div>
        </div>
        {posts.length === 0 ? (
          <EmptyState
            title="Nothing to track yet"
            description="Run a campaign and the lifecycle will show up here."
            action={
              canMutate ? (
                <Link href="/campaigns/new" className="btn btn-primary">
                  Create content
                </Link>
              ) : undefined
            }
          />
        ) : (
          <TrackBoard
            posts={posts}
            stepsByCampaign={stepsByCampaign}
            canMutate={canMutate}
          />
        )}
      </div>
    </AppShell>
  );
}
