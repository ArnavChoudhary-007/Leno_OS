import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={can(ctx.role, "mutate")}
      current="help"
      workspaceId={ctx.workspaceId}
    >
      <div className="help-prose">
        <h1 className="content-page-title">How Leno OS works</h1>
        <p>
          One campaign brief becomes on-brand, platform-native social posts. An orchestrator
          plans the work, specialist agents draft it, a critic scores it, and a human approves
          it. Only then does plain code publish.
        </p>
        <ol>
          <li>Write a brief on Create. Agents never publish from here.</li>
          <li>The orchestrator picks a goal, audience, and channels.</li>
          <li>Platform agents write LinkedIn, Instagram, X, and Threads copy.</li>
          <li>The critic scores each draft. Below 0.8 goes back for revision, max 3 rounds.</li>
          <li>You approve, schedule, or reject on Content, Track, or the campaign page.</li>
          <li>Approved LinkedIn drafts publish to a connected LinkedIn account. Other channels still publish to Bluesky when that is configured.</li>
        </ol>
        <p>
          Brand voice lives under Settings. Change the brand card and the next run writes
          differently. Analytics counts workspace output — not third-party impressions.
        </p>
      </div>
    </AppShell>
  );
}
