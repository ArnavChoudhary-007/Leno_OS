import Link from "next/link";
import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NoWorkspace } from "@/components/no-workspace";
import { Sparkline } from "@/components/leno/sparkline";
import { PlatformPill } from "@/components/leno/platform-pill";
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
  draftStage,
  greetingName,
  platformLabel,
  sparklineFromCounts,
  stageBadgeClass,
} from "@/lib/workspace-ui";
import { OverviewPerformance } from "./overview-performance";
import { ArrowRight, Bot } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const [profile, stats, campaignStats, scheduled, latest, activity, lastStep] =
    await Promise.all([
      getBrandProfile(ctx.workspaceId),
      workspaceDraftStats(ctx.workspaceId),
      workspaceCampaignStats(ctx.workspaceId),
      listScheduledDraftsInWorkspace(ctx.workspaceId),
      listWorkspaceLatestDrafts(ctx.workspaceId, 8),
      listDraftActivity(ctx.workspaceId),
      latestWorkspaceRunStep(ctx.workspaceId),
    ]);
  const canMutate = can(ctx.role, "mutate");
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const postsSeries = bucketByDay(
    activity.map((row) => row.created_at),
    14,
  );
  const reviewSeries = bucketByDay(
    activity
      .filter((row) => row.status === "needs_human" || row.status === "draft")
      .map((row) => row.created_at),
    14,
  );
  const scheduledSeries = bucketByDay(
    activity.filter((row) => row.scheduled_at).map((row) => row.created_at),
    14,
  );
  const publishedSeries = bucketByDay(
    activity.filter((row) => row.status === "published").map((row) => row.created_at),
    14,
  );

  const currentTask = lastStep
    ? `${lastStep.step} · ${lastStep.model === "-" ? "code" : lastStep.model}`
    : "Idle — waiting for a brief";
  const agentsLive = campaignStats.running > 0;

  const agents = [
    {
      name: "Orchestrator",
      task: agentsLive ? currentTask : "Ready to route the next brief",
    },
    {
      name: "LinkedIn Agent",
      task: "Long-form thought leadership",
    },
    {
      name: "Instagram Agent",
      task: "Carousel copy and visual captions",
    },
    {
      name: "Twitter/X Agent",
      task: "Hooks and short-form threads",
    },
  ];

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="overview"
      workspaceId={ctx.workspaceId}
    >
      <section className="overview-greeting-section">
        <div>
          <p className="greeting-date">{today}</p>
          <h1 className="greeting-title">
            Good evening, {greetingName(ctx.email)}
            <span className="greeting-status-dot" title="Distribution engine running" />
          </h1>
          <p className="greeting-subtext">
            {profile
              ? `Your content engine is running as ${profile.name}.`
              : "Set up a brand card, then run a campaign from a brief."}
          </p>
        </div>
        {canMutate ? (
          <Link href="/campaigns/new" className="greeting-action-link">
            <span>Create. Distribute. Grow.</span>
            <ArrowRight size={16} />
          </Link>
        ) : null}
      </section>

      {stats.review > 0 ? (
        <div className="attention-strip">
          <div className="attention-left">
            <div className="attention-icon-box">!</div>
            <span className="attention-text">
              {stats.review} post{stats.review === 1 ? "" : "s"} waiting for your review
            </span>
          </div>
          <Link href="/campaigns?status=Review" className="btn btn-sm btn-primary">
            Review Pending Posts →
          </Link>
        </div>
      ) : null}

      <section className="metrics-row">
        <article className="metric-card">
          <div className="metric-top-row">
            <div className="metric-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="metric-numbers">
              <p className="metric-value">{stats.published}</p>
              <p className="metric-label">Posts Published</p>
            </div>
          </div>
          <div className="metric-bottom-row">
            <span className="metric-trend trend-up">after approval</span>
            <div className="sparkline-container">
              <Sparkline values={sparklineFromCounts(publishedSeries.map((p) => p.val))} />
            </div>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-top-row">
            <div className="metric-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="metric-numbers">
              <p className="metric-value">{stats.review}</p>
              <p className="metric-label">Awaiting Review</p>
            </div>
          </div>
          <div className="metric-bottom-row">
            <span className="metric-trend trend-down">drafts + critic holds</span>
            <div className="sparkline-container">
              <Sparkline
                values={sparklineFromCounts(reviewSeries.map((p) => p.val))}
                trend="down"
              />
            </div>
          </div>
        </article>
        <article className="metric-card">
          <div className="metric-top-row">
            <div className="metric-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="metric-numbers">
              <p className="metric-value">{stats.scheduled}</p>
              <p className="metric-label">Scheduled</p>
            </div>
          </div>
          <div className="metric-bottom-row">
            <span className="metric-trend trend-up">approved, not live</span>
            <div className="sparkline-container">
              <Sparkline values={sparklineFromCounts(scheduledSeries.map((p) => p.val))} />
            </div>
          </div>
        </article>
        <Link href="/agents" className="metric-card" style={{ cursor: "pointer" }}>
          <div className="metric-top-row">
            <div className="metric-icon-box">
              <Bot size={18} />
            </div>
            <div className="metric-numbers">
              <p className="metric-value">{agentsLive ? 3 : 4}</p>
              <p className="metric-label">Agents Active</p>
            </div>
          </div>
          <div className="metric-bottom-row">
            <span className="metric-trend trend-neutral" style={{ fontSize: "0.75rem" }}>
              ● All systems operational
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>›</span>
          </div>
        </Link>
      </section>

      <section className="overview-grid">
        <div className="overview-left-col">
          <article className="card">
            <div className="module-header">
              <h2 className="module-title">Agents</h2>
              <Link href="/agents" className="module-link">
                View all
              </Link>
            </div>
            {agents.map((agent) => (
              <div key={agent.name} className="agent-item-card">
                <div className="agent-item-left">
                  <div className="agent-icon-avatar">
                    <Bot size={18} />
                  </div>
                  <div className="agent-meta-info">
                    <p className="agent-name">{agent.name}</p>
                    <p className="agent-task-desc">{agent.task}</p>
                  </div>
                </div>
              </div>
            ))}
          </article>

          <article className="card">
            <div className="module-header">
              <h2 className="module-title">Upcoming Schedule</h2>
              <Link href="/campaigns" className="module-link">
                View all
              </Link>
            </div>
            {scheduled.length === 0 ? (
              <p className="card-subtitle">Nothing scheduled yet. Approve a draft, then pick a time.</p>
            ) : (
              scheduled.map((draft) => (
                <Link
                  key={draft.id}
                  href={`/campaigns/${draft.campaign_id}`}
                  className="schedule-item"
                >
                  <div className="schedule-item-left">
                    <div className="schedule-platform-icon">
                      {platformLabel(draft.platform).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="schedule-details">
                      <p className="schedule-title">{draft.body.slice(0, 72)}</p>
                      <p className="schedule-time">
                        {draft.scheduled_at
                          ? new Date(draft.scheduled_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              timeZone: "UTC",
                            })
                          : draft.platform}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </article>
        </div>

        <div className="overview-right-col">
          <article className="leno-performance-card">
            <div className="card-top-controls">
              <form action="/campaigns" className="in-card-search">
                <svg className="in-card-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  name="q"
                  className="in-card-search-input"
                  placeholder="Search content, campaigns..."
                />
              </form>
              <div className="in-card-date-select">
                <span>Last 14 days</span>
              </div>
            </div>
            <OverviewPerformance
              impressions={publishedSeries}
              engagement={reviewSeries}
              clicks={scheduledSeries}
              posts={postsSeries}
            />
          </article>

          <article className="recent-content-section">
            <div className="recent-content-header">
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>Recent Content</span>
              <Link href="/campaigns" className="module-link">
                View all
              </Link>
            </div>
            {latest.length === 0 ? (
              <EmptyState
                title="No content yet"
                description={
                  canMutate
                    ? "Paste a brief to start the first run."
                    : "When an editor runs a campaign, posts will show up here."
                }
              />
            ) : (
              <div className="recent-content-list">
                {latest.map((draft) => {
                  const stage = draftStage(draft);
                  return (
                    <Link
                      key={draft.id}
                      href={`/campaigns/${draft.campaign_id}`}
                      className="content-row-item"
                    >
                      <div className="content-row-left">
                        <div className="content-thumb-preview">
                          {(draft.campaign_goal ?? draft.body).slice(0, 1)}
                        </div>
                        <div className="content-title-meta">
                          <p className="content-row-title">
                            {draft.campaign_goal ?? draft.body.slice(0, 80)}
                          </p>
                          <p className="card-subtitle">
                            <PlatformPill platform={draft.platform} />
                          </p>
                        </div>
                      </div>
                      <span className={`badge ${stageBadgeClass(stage)}`}>
                        <span className="badge-dot" />
                        {stage}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </article>
        </div>
      </section>
    </AppShell>
  );
}
