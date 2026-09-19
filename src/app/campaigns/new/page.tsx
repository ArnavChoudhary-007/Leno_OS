import { redirect } from "next/navigation";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import { PageHeader } from "@/components/page-header";
import { BriefForm } from "./brief-form";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;
  if (!can(ctx.role, "mutate")) redirect("/");

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate
      current="campaign"
    >
      <PageHeader
        eyebrow="Campaign"
        title="What are we shipping?"
        description="Describe the launch, the audience, and the outcome. We’ll plan, draft, and score — you approve what goes out."
      />
      <div className="surface mt-8 rounded-2xl border border-border p-6">
        <BriefForm />
      </div>
    </AppShell>
  );
}
