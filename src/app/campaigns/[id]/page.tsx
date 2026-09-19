import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { getCampaignInWorkspace } from "@/db/queries/campaigns";
import { CampaignView } from "./campaign-view";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: PageProps<"/campaigns/[id]">) {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const { id } = await params;
  const campaign = await getCampaignInWorkspace(ctx.workspaceId, id);
  const canMutate = can(ctx.role, "mutate");

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="content"
      workspaceId={ctx.workspaceId}
    >
      {campaign ? (
        <CampaignView campaignId={id} />
      ) : (
        <EmptyState
          title="Campaign not found"
          description="It may belong to another workspace, or the link is stale. Start a new run from a brief."
        />
      )}
    </AppShell>
  );
}
