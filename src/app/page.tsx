import Link from "next/link";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { PageHeader } from "@/components/page-header";
import { WorkflowHero } from "@/components/workflow-hero";
import { buttonVariants } from "@/components/ui/button";
import { getBrandProfile } from "@/db/queries/brand";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const profile = await getBrandProfile(ctx.workspaceId);
  const canMutate = can(ctx.role, "mutate");

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="home"
      width="wide"
    >
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
        <PageHeader
          eyebrow="Workspace"
          title="One brief. Every channel. On brand."
          description="Write a campaign once. Agents plan and draft native posts, a critic scores them, and you approve what goes out."
        />
        <div className="hidden lg:block">
          <WorkflowHero />
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {profile ? (
          <section className="surface rounded-2xl border border-border p-5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Brand
            </p>
            <p className="mt-2 text-base font-semibold">{profile.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {profile.one_liner}
            </p>
            <Link
              href="/brand"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
            >
              Edit brand
            </Link>
          </section>
        ) : (
          <EmptyState
            title="No brand profile yet"
            description="Agents write from this card. Add your voice, or load the Loopwave demo to see a filled example."
            action={
              <Link href="/brand" className={cn(buttonVariants({ size: "sm" }))}>
                Set up brand
              </Link>
            }
          />
        )}

        <section className="surface rounded-2xl border border-border p-5">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            How a run works
          </p>
          <ol className="mt-3 space-y-3">
            {[
              "Confirm the brand card agents will write against.",
              "Paste a brief and watch the live pipeline.",
              "Approve, edit, or publish drafts.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          {profile && canMutate ? (
            <Link
              href="/campaigns/new"
              className={cn(buttonVariants({ size: "sm" }), "mt-5")}
            >
              New campaign
            </Link>
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">
              {canMutate
                ? "Set up a brand first — then you can run a campaign."
                : "You can review campaigns, but starting one needs an editor."}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
