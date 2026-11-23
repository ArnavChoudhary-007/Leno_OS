import Link from "next/link";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { getEnabledPlaybooks } from "@/agents/platforms";
import { AppShell } from "@/components/app-shell";
import { ArrowIcon } from "@/components/app-chrome";
import { EmptyState } from "@/components/empty-state";
import { Greeting } from "@/components/leno/greeting";
import { NoWorkspace } from "@/components/no-workspace";
import { getBrandProfile } from "@/db/queries/brand";
import { workspaceCampaignStats } from "@/db/queries/campaigns";
import {
  listDraftActivity,
  listScheduledDraftsInWorkspace,
  listWorkspaceLatestDrafts,
  workspaceDraftStats,
} from "@/db/queries/drafts";
import { latestWorkspaceRunStep } from "@/db/queries/runs";
import {
  bucketByDay,
  greetingName,
  isWaiting,
  platformLabel,
  postTitle,
  relativeTime,
  shortDateTime,
  sparkPoints,
  statusBadgeClass,
  statusWord,
} from "@/lib/workspace-ui";
import { OverviewPerformance } from "./overview-performance";

export const dynamic = "force-dynamic";

const STEP_DOING: Record<string, string> = {
  load_context: "Reading the brand card",
  plan: "Planning a campaign",
  strategy: "Shaping the angle",
  research: "Researching the topic",
  roster: "Picking the writers",
  draft: "Writing drafts",
  image: "Making the image",
  critique: "Scoring drafts",
  revise: "Revising drafts",
  summary: "Handing posts to you",
};

export default async function Home() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const [profile, stats, campaignStats, scheduled, latest, activity, lastStep] =
    await Promise.all([
      getBrandProfile(ctx.workspaceId),
      workspaceDraftStats(ctx.workspaceId),
      workspaceCampaignStats(ctx.workspaceId),
      listScheduledDraftsInWorkspace(ctx.workspaceId, 5),
      listWorkspaceLatestDrafts(ctx.workspaceId, 200),
      listDraftActivity(ctx.workspaceId),
      latestWorkspaceRunStep(ctx.workspaceId),
    ]);
  const canMutate = can(ctx.role, "mutate");
  const live = campaignStats.running > 0;
  const rows = activity.filter((r) => r.status !== "superseded");

  const waiting = latest.filter(isWaiting);
  const oldestWaiting = waiting.reduce<string | null>(
    (old, d) => (!old || d.created_at < old ? d.created_at : old),
    null,
  );
  const series = (pred: (r: (typeof rows)[number]) => boolean) =>
    bucketByDay(rows.filter(pred).map((r) => r.created_at), 14).map((p) => p.val);

  const metrics = [
    {
      value: stats.published,
      label: "Published",
      note: stats.published ? "Live after your approval" : "Nothing live yet",
      href: "/campaigns?status=Published",
      points: series((r) => r.status === "published"),
      lime: true,
    },
    {
      value: waiting.length,
      label: "Waiting for you",
      note: oldestWaiting ? `Oldest from ${relativeTime(oldestWaiting)}` : "You’re all caught up",
      href: "/campaigns?status=Waiting",
      points: series((r) => r.status === "draft" || r.status === "needs_human"),
      lime: false,
    },
    {
      value: stats.scheduled,
      label: "Scheduled",
      note: scheduled[0]?.scheduled_at ? `Next ${shortDateTime(scheduled[0].scheduled_at)}` : "Nothing queued",
      href: "/campaigns?status=Scheduled",
      points: series((r) => r.status === "approved" && r.scheduled_at !== null),
      lime: false,
    },
    {
      value: latest.length,
      label: "Posts written",
      note: live ? "Agents are writing now" : `${campaignStats.total} campaign${campaignStats.total === 1 ? "" : "s"} so far`,
      href: "/track",
      points: series(() => true),
      lime: false,
    },
  ];

  const stepNow = lastStep ? STEP_DOING[lastStep.step] ?? lastStep.step : null;
  const agents = [
    { label: "Orchestrator", task: live && stepNow ? stepNow : "Ready for the next idea", on: true },
    ...getEnabledPlaybooks().map((p) => ({
      label: `${p.displayName} writer`,
      task: live ? "Writing" : "Ready",
      on: true,
    })),
    { label: "Critic", task: live ? "Scores every draft" : "Passes at 0.80", on: true },
  ];

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="overview"
      workspaceId={ctx.workspaceId}
    >
      <div className="l-page">
        <div className="l-page-header">
          <Greeting name={greetingName(ctx.email)} />
          {canMutate ? (
            <Link href="/campaigns/new" className="l-cta l-cta-sm">
              Write a post
              <ArrowIcon size={18} />
            </Link>
          ) : null}
        </div>

        {!profile ? (
          <div className="l-notice">
            <span className="l-notice-pill">!</span>
            <span className="l-notice-text">Set up the brand card so every agent writes in your voice</span>
            <Link href="/brand" className="l-btn l-btn-outline">
              Open Settings
            </Link>
          </div>
        ) : waiting.length > 0 ? (
          <div className="l-notice">
            <span className="l-notice-pill">{waiting.length}</span>
            <span className="l-notice-text">
              {waiting.length === 1 ? "Post is" : "Posts are"} waiting for your review
              {oldestWaiting ? `, the oldest since ${relativeTime(oldestWaiting)}` : ""}
            </span>
            <Link href="/campaigns?status=Waiting" className="l-btn l-btn-outline">
              Review them
            </Link>
          </div>
        ) : null}

        <div className="l-metrics">
          {metrics.map((m) => (
            <Link key={m.label} href={m.href} className="l-metric">
              <div className="l-metric-top">
                <span className="l-num" style={{ fontSize: 56 }}>
                  {m.value}
                </span>
                <svg aria-hidden="true" width="96" height="36" viewBox="0 0 96 36" fill="none">
                  <polyline
                    points={sparkPoints(m.points)}
                    stroke={m.lime ? "#C8FF1A" : "#F5F5F2"}
                    strokeWidth="2"
                    fill="none"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="l-metric-text">
                <span className="l-metric-label">{m.label}</span>
                <span className="l-metric-note">{m.note}</span>
              </div>
            </Link>
          ))}
        </div>

        <OverviewPerformance
          rows={rows.map((r) => ({ created_at: r.created_at, status: r.status, scheduled_at: r.scheduled_at }))}
        />

        <div className="l-two">
          <section aria-labelledby="ag-h" className="l-card l-stack-8">
            <div className="l-card-head">
              <h2 id="ag-h" className="l-card-title">
                Agents
              </h2>
              <Link href="/agents" className="l-link">
                View all
              </Link>
            </div>
            {agents.map((a) => (
              <div key={a.label} className="l-list-row">
                <span aria-hidden="true" className={`l-dot${live ? " l-pulse" : ""}`} />
                <span style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{a.label}</span>
                <span className="l-muted" style={{ fontSize: 14 }}>
                  {a.task}
                </span>
              </div>
            ))}
          </section>
          <section aria-labelledby="sch-h" className="l-card l-stack-8">
            <div className="l-card-head">
              <h2 id="sch-h" className="l-card-title">
                Coming up
              </h2>
              <Link href="/track" className="l-link">
                View all
              </Link>
            </div>
            {scheduled.length === 0 ? (
              <p className="l-muted" style={{ margin: 0, padding: "12px 0", borderTop: "1px solid var(--l-line-soft)" }}>
                Nothing scheduled. Approve a post, then pick a time on Track.
              </p>
            ) : (
              scheduled.map((d) => (
                <Link key={d.id} href={`/campaigns/${d.campaign_id}`} className="l-sched-row">
                  <span className="l-muted" style={{ fontSize: 14 }}>
                    {d.scheduled_at ? shortDateTime(d.scheduled_at) : ""}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span className="l-clip">{postTitle(d)}</span>
                    <span className="l-faint" style={{ fontSize: 13 }}>
                      {platformLabel(d.platform)}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </section>
        </div>

        <section aria-labelledby="rc-h" className="l-card">
          <div className="l-card-head" style={{ paddingBottom: 16 }}>
            <h2 id="rc-h" className="l-card-title">
              Recent content
            </h2>
            <Link href="/campaigns" className="l-link">
              View all
            </Link>
          </div>
          {latest.length === 0 ? (
            <EmptyState
              title="No posts yet"
              description={
                canMutate
                  ? "Write one idea on Create and Leno drafts a post for every platform you pick."
                  : "When an editor runs a campaign, posts show up here."
              }
              action={
                canMutate ? (
                  <Link href="/campaigns/new" className="l-btn l-btn-lime">
                    Write a post
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="l-table-wrap">
              <table className="l-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 0 }}>Post</th>
                    <th>Platform</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right", paddingRight: 0 }}>Written</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.slice(0, 6).map((d) => (
                    <tr key={d.id}>
                      <td style={{ paddingLeft: 0, maxWidth: 480 }}>
                        <Link href={`/campaigns/${d.campaign_id}`} className="l-row-link l-clip">
                          {postTitle(d)}
                        </Link>
                      </td>
                      <td className="l-muted">{platformLabel(d.platform)}</td>
                      <td>
                        <span className={statusBadgeClass(d)}>{statusWord(d)}</span>
                      </td>
                      <td className="l-num-cell l-muted" style={{ paddingRight: 0, fontSize: 14 }}>
                        {relativeTime(d.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
