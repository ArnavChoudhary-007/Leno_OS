import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import type { AgentInfo } from "@/components/leno/agent-drawer";
import { workspaceCampaignStats } from "@/db/queries/campaigns";
import { workspaceDraftStats } from "@/db/queries/drafts";
import { latestWorkspaceRunStep } from "@/db/queries/runs";
import { AgentsView } from "./agents-view";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const [stats, campaignStats, lastStep] = await Promise.all([
    workspaceDraftStats(ctx.workspaceId),
    workspaceCampaignStats(ctx.workspaceId),
    latestWorkspaceRunStep(ctx.workspaceId),
  ]);
  const live = campaignStats.running > 0;
  const lastActive = lastStep
    ? new Date(lastStep.created_at).toLocaleString()
    : "Waiting for first run";
  const current = lastStep ? lastStep.step : "Idle";

  const agents: AgentInfo[] = [
    {
      id: "orchestrator",
      name: "Orchestrator",
      role: "Central Intelligence & Task Router",
      status: live ? "Running" : "Ready",
      statusType: live ? "green" : "blue",
      currentTask: live ? current : "Coordinating tasks",
      tasksCompleted: stats.total,
      uptime: "On-brand",
      lastActive,
      capabilities: [
        "Task routing",
        "Cross-platform coherence",
        "Quality gatekeeping",
        "Human-in-the-loop queue",
      ],
    },
    {
      id: "linkedin",
      name: "LinkedIn Agent",
      role: "Enterprise Thought Leadership",
      status: "Active",
      statusType: "green",
      currentTask: "Long-form posts",
      tasksCompleted: stats.total,
      uptime: "Enabled",
      lastActive,
      capabilities: [
        "Long-form posts",
        "Brand voice",
        "Tavily research",
        "OAuth publish after approval",
      ],
    },
    {
      id: "instagram",
      name: "Instagram Agent",
      role: "Visual Storyteller & Carousel Specialist",
      status: "Active",
      statusType: "green",
      currentTask: "Carousel copy",
      tasksCompleted: stats.total,
      uptime: "Enabled",
      lastActive,
      capabilities: ["Carousel copy", "Hashtag clustering", "Visual captions"],
    },
    {
      id: "x",
      name: "Twitter/X Agent",
      role: "High-Velocity Hook Engine",
      status: "Active",
      statusType: "green",
      currentTask: "Short-form hooks",
      tasksCompleted: stats.total,
      uptime: "Enabled",
      lastActive,
      capabilities: ["Thread crafting", "Character budgeting", "Punchy CTAs"],
    },
  ];

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={can(ctx.role, "mutate")}
      current="agents"
      workspaceId={ctx.workspaceId}
    >
      <AgentsView agents={agents} />
    </AppShell>
  );
}
