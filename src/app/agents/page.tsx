import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import type { AgentInfo } from "@/components/leno/agent-drawer";
import { workspaceCampaignStats } from "@/db/queries/campaigns";
import { listWorkspaceLatestDrafts } from "@/db/queries/drafts";
import { latestWorkspaceRunStep } from "@/db/queries/runs";
import { AgentsView } from "./agents-view";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const [posts, campaignStats, lastStep] = await Promise.all([
    listWorkspaceLatestDrafts(ctx.workspaceId, null),
    workspaceCampaignStats(ctx.workspaceId),
    latestWorkspaceRunStep(ctx.workspaceId),
  ]);
  const live = campaignStats.running > 0;
  const lastActive = lastStep
    ? new Date(lastStep.created_at).toLocaleString()
    : "Waiting for first run";
  const current = lastStep ? lastStep.step : "Idle";
  const platformCounts = new Map<string, number>();
  for (const post of posts) platformCounts.set(post.platform, (platformCounts.get(post.platform) ?? 0) + 1);
  const platformLastActive = (platform: string) => {
    const latest = posts.filter((post) => post.platform === platform)
      .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0];
    return latest ? new Date(latest.created_at).toLocaleString() : "No drafts yet";
  };

  const agents: AgentInfo[] = [
    {
      id: "orchestrator",
      name: "Orchestrator",
      role: "Central Intelligence & Task Router",
      status: live ? "Running" : "Ready",
      statusType: live ? "green" : "blue",
      currentTask: live ? current : "Coordinating tasks",
      tasksCompleted: campaignStats.total,
      countLabel: "Campaigns tracked",
      availability: "Configured",
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
      tasksCompleted: platformCounts.get("linkedin") ?? 0,
      countLabel: "Current drafts",
      availability: "Configured",
      lastActive: platformLastActive("linkedin"),
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
      tasksCompleted: platformCounts.get("instagram") ?? 0,
      countLabel: "Current drafts",
      availability: "Export only",
      lastActive: platformLastActive("instagram"),
      capabilities: ["Carousel copy", "Hashtag clustering", "Visual captions"],
    },
    {
      id: "x",
      name: "Twitter/X Agent",
      role: "High-Velocity Hook Engine",
      status: "Active",
      statusType: "green",
      currentTask: "Short-form hooks",
      tasksCompleted: platformCounts.get("x") ?? 0,
      countLabel: "Current drafts",
      availability: "Bluesky publishing",
      lastActive: platformLastActive("x"),
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
