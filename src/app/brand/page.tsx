import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { PageHeader } from "@/components/page-header";
import { getBrandProfile } from "@/db/queries/brand";
import { BrandForm } from "./brand-form";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const profile = await getBrandProfile(ctx.workspaceId);
  const canMutate = can(ctx.role, "mutate");
  const canLoadDemo =
    can(ctx.role, "load_demo") && process.env.NODE_ENV !== "production";

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="brand"
      workspaceId={ctx.workspaceId}
    >
      <div className="l-page">
        <PageHeader
          title="Brand card"
          description="Voice, audience and examples live here. Every agent reads this before it writes, so change it and the next post sounds different."
        />

        {!profile ? (
          <EmptyState
            title="Nothing saved yet"
            description={
              canLoadDemo
                ? "Fill in the form, or load the Loopwave demo to see how a complete brand card looks."
                : "Fill in the form below. Leno can’t write posts until a brand card is saved."
            }
          />
        ) : null}

        <div className="l-card" style={{ padding: 28 }}>
          <BrandForm
            key={profile?.updated_at ?? "empty"}
            profile={profile}
            readOnly={!canMutate}
            showDemo={canLoadDemo}
          />
        </div>
      </div>
    </AppShell>
  );
}
