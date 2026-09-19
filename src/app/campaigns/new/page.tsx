import { redirect } from "next/navigation";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import { getBrandProfile } from "@/db/queries/brand";
import { BriefForm } from "./brief-form";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;
  if (!can(ctx.role, "mutate")) redirect("/");

  const profile = await getBrandProfile(ctx.workspaceId);

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate
      current="create"
      workspaceId={ctx.workspaceId}
    >
      <BriefForm
        brandName={profile?.name}
        toneWords={profile?.tone_words}
        audience={profile?.audience}
      />
    </AppShell>
  );
}
