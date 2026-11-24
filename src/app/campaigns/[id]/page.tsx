import Link from "next/link";
import { loadPageAuth } from "@/auth/server";
import { can, isAdminRole } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { getCampaignInWorkspace } from "@/db/queries/campaigns";
import { publishAccess } from "@/lib/publish-access";
import { CampaignView } from "./campaign-view";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: PageProps<"/campaigns/[id]">) {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const { id } = await params;
  const [campaign, access] = await Promise.all([
    getCampaignInWorkspace(ctx.workspaceId, id),
    publishAccess(ctx.workspaceId, ctx.role),
  ]);
  const canMutate = can(ctx.role, "mutate");

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="content"
      workspaceId={ctx.workspaceId}
    >
      <div className="l-page">
        {campaign ? (
          <CampaignView campaignId={id} canMutate={canMutate} isAdmin={isAdminRole(ctx.role)} publish={access} />
        ) : (
          <EmptyState
            title="Campaign not found"
            description="It may belong to another workspace, or the link is old. Start a new one from Create."
            action={
              <Link href="/campaigns" className="l-btn l-btn-outline">
                Back to Content
              </Link>
            }
          />
        )}
      </div>
    </AppShell>
  );
}
