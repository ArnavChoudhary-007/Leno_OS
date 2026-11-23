import Link from "next/link";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { PageHeader } from "@/components/page-header";
import { listWorkspaceLatestDrafts } from "@/db/queries/drafts";
import { listWorkspaceRunSteps } from "@/db/queries/runs";
import { publishAccess } from "@/lib/publish-access";
import { TrackBoard, type TrackStep } from "./track-board";

export const dynamic = "force-dynamic";

export default async function TrackPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const params = (await searchParams) ?? {};
  const canMutate = can(ctx.role, "mutate");
  const [posts, steps, access] = await Promise.all([
    listWorkspaceLatestDrafts(ctx.workspaceId),
    listWorkspaceRunSteps(ctx.workspaceId),
    publishAccess(ctx.workspaceId, ctx.role),
  ]);

  const stepsByCampaign: Record<string, TrackStep[]> = {};
  for (const step of steps) {
    (stepsByCampaign[step.campaign_id] ??= []).push({
      step: step.step,
      phase: step.phase,
      created_at: step.created_at,
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
      <div className="l-page">
        <PageHeader title="Track" />
        {posts.length === 0 ? (
          <EmptyState
            title="Nothing to track yet"
            description="Write a post on Create and you’ll see it move from draft to live here."
            action={
              canMutate ? (
                <Link href="/campaigns/new" className="l-btn l-btn-lime">
                  Write a post
                </Link>
              ) : undefined
            }
          />
        ) : (
          <TrackBoard
            posts={posts}
            stepsByCampaign={stepsByCampaign}
            canMutate={canMutate}
            publish={access}
            initialOpen={typeof params.post === "string" ? params.post : undefined}
          />
        )}
      </div>
    </AppShell>
  );
}
