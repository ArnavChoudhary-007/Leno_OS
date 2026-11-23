import Link from "next/link";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import { PageHeader } from "@/components/page-header";

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
      <div className="l-page">
        <PageHeader
          title="How Leno works"
          description="One idea becomes an on-brand, native post for every platform you pick. Agents plan and write, a critic checks, you approve, and only then does plain code publish."
        />
        <div className="l-help">
          <ol>
            <li>
              <span>
                Write the idea on <Link href="/campaigns/new" className="l-link-lime">Create</Link> and pick
                the platforms. Leno only writes for the ones you pick.
              </span>
            </li>
            <li>
              <span>The orchestrator reads your brand card, then sets a goal, an audience and one key message.</span>
            </li>
            <li>
              <span>
                A strategy agent picks the angle. LinkedIn gets live research when Tavily is set up, and an image is
                made when you don’t upload a photo.
              </span>
            </li>
            <li>
              <span>Each platform writer drafts a native post, held to that platform’s character and hashtag limits in code.</span>
            </li>
            <li>
              <span>
                The critic scores every draft on brand voice, goal fit, platform fit and craft. Below 0.80 goes back to the
                writer, up to 3 rounds, then it comes to you flagged.
              </span>
            </li>
            <li>
              <span>
                You approve, edit, or ask for changes on Create, Content or{" "}
                <Link href="/track" className="l-link-lime">Track</Link>. Asking for changes sends your note to the writer
                and the critic re-scores the new version.
              </span>
            </li>
            <li>
              <span>
                Approved LinkedIn posts publish to your connected LinkedIn account; other platforms publish through Bluesky
                when it’s set up. Publish now, or schedule it and Leno posts it at that time.
              </span>
            </li>
          </ol>
          <p>
            Brand voice lives under <Link href="/brand" className="l-link-lime">Settings</Link>. Change the brand card and the
            next run writes differently. Analytics counts what Leno wrote and shipped; views from each platform aren’t
            connected yet.
          </p>
          <p className="l-faint" style={{ fontSize: 15 }}>
            Press ⌘K (Ctrl+K on Windows) anywhere to search posts or jump to a page.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
