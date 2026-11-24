import Link from "next/link";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { ArrowIcon } from "@/components/app-chrome";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { PageHeader } from "@/components/page-header";
import { getBrandProfile } from "@/db/queries/brand";
import { listWorkspaceLatestDrafts } from "@/db/queries/drafts";
import { ContentLibrary } from "./content-library";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const params = (await searchParams) ?? {};
  const canMutate = can(ctx.role, "mutate");
  const [posts, profile] = await Promise.all([
    listWorkspaceLatestDrafts(ctx.workspaceId),
    getBrandProfile(ctx.workspaceId),
  ]);
  const brand = profile?.name ?? "Your brand";

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="content"
      workspaceId={ctx.workspaceId}
    >
      <div className="l-page l-page-tight">
        <PageHeader
          title="Content"
          count={posts.length}
          actions={
            canMutate ? (
              <Link href="/campaigns/new" className="l-cta l-cta-sm">
                Write a post
                <ArrowIcon size={18} />
              </Link>
            ) : null
          }
        />
        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Write one idea on Create. Agents plan and draft a post per platform; you approve."
            action={
              canMutate ? (
                <Link href="/campaigns/new" className="l-btn l-btn-lime">
                  Write a post
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ContentLibrary
            posts={posts}
            canMutate={canMutate}
            initialStatus={typeof params.status === "string" ? params.status : undefined}
            initialQuery={typeof params.q === "string" ? params.q : undefined}
            author={{ name: brand, handle: brand.toLowerCase().replace(/\s+/g, "") }}
          />
        )}
      </div>
    </AppShell>
  );
}
