import Link from "next/link";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { listWorkspaceLatestDrafts } from "@/db/queries/drafts";
import { getBrandProfile } from "@/db/queries/brand";
import { greetingName } from "@/lib/workspace-ui";
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
  const name = greetingName(ctx.email);
  const handle = (profile?.name ?? name).toLowerCase().replace(/\s+/g, "");

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="content"
      workspaceId={ctx.workspaceId}
    >
      <div className="content-page-header">
        <div>
          <h1 className="content-page-title">Content Library</h1>
          <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginTop: 2 }}>
            Central repository of drafts, reviews, scheduled posts, and live publications.
          </p>
        </div>
        {canMutate ? (
          <Link href="/campaigns/new" className="btn btn-primary">
            + New Content
          </Link>
        ) : null}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No posts yet"
          description="Paste a brief to start the first run. Agents plan and draft; you approve."
          action={
            canMutate ? (
              <Link href="/campaigns/new" className="btn btn-primary">
                Create content
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
          author={{
            name: profile?.name ?? name,
            handle,
            initial: name.slice(0, 1).toUpperCase(),
            role: profile?.one_liner,
          }}
        />
      )}
    </AppShell>
  );
}
