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
      width="wide"
    >
      <PageHeader
        eyebrow="Brand"
        title="The card every agent reads"
        description="Voice, audience, and examples live here. Change this, and the next campaign writes differently."
      />

      {!profile ? (
        <EmptyState
          className="mt-6"
          title="Nothing saved yet"
          description="Fill in the form, or load the Loopwave demo to see how a complete brand card looks."
        />
      ) : null}

      <div className="mt-8">
        <BrandForm
          key={profile?.updated_at ?? "empty"}
          profile={profile}
          readOnly={!canMutate}
          showDemo={canLoadDemo}
        />
      </div>
    </AppShell>
  );
}
