import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { PLATFORM_PLAYBOOKS } from "@/agents/platforms";
import { MAX_REVISION_ROUNDS, PASS_THRESHOLD } from "@/agents/critic";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import { workspaceCampaignStats } from "@/db/queries/campaigns";
import { listDraftActivity, listWorkspaceLatestDrafts } from "@/db/queries/drafts";
import { listWorkspaceRunSteps } from "@/db/queries/runs";
import { env } from "@/env";
import { relativeTime } from "@/lib/workspace-ui";
import { isImageGenerationConfigured } from "@/tools/openai-image";
import { tavilyConfigured } from "@/tools/tavily";
import { AgentsView, type AgentCard } from "./agents-view";

export const dynamic = "force-dynamic";

const PLATFORM_ROLE: Record<string, { role: string; caps: string[] }> = {
  linkedin: {
    role: "Writes long-form posts that open with a claim and end with a question, for a professional feed",
    caps: ["Long-form posts", "Live research", "Brand voice", "Publishes after approval"],
  },
  x: {
    role: "Writes short posts that land the idea inside 280 characters",
    caps: ["280-character budget", "Hooks", "Punchy endings"],
  },
  instagram: {
    role: "Writes the caption and slide copy for a feed post or carousel",
    caps: ["Captions", "Carousel slides", "Hashtag sets", "Image crop 4:5"],
  },
  threads: {
    role: "Writes a conversational take that invites replies",
    caps: ["500-character budget", "Reply-native tone"],
  },
  facebook: {
    role: "Writes Page posts. Built, switched off until the Page integration lands",
    caps: ["Page posts"],
  },
};

export default async function AgentsPage() {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const [campaignStats, steps, activity, latest] = await Promise.all([
    workspaceCampaignStats(ctx.workspaceId),
    listWorkspaceRunSteps(ctx.workspaceId),
    listDraftActivity(ctx.workspaceId),
    listWorkspaceLatestDrafts(ctx.workspaceId),
  ]);
  const live = campaignStats.running > 0;
  const lastStep = steps.at(-1) ?? null;

  const stepCount = (name: string) => steps.filter((s) => s.step === name).length;
  const lastAt = (names: string[]) => {
    const hit = [...steps].reverse().find((s) => names.includes(s.step));
    return hit ? relativeTime(hit.created_at) : "Not yet";
  };
  const scored = latest.filter((d) => d.score != null);
  const passRate = scored.length
    ? `${Math.round((scored.filter((d) => (d.score ?? 0) >= PASS_THRESHOLD).length / scored.length) * 100)}%`
    : "—";

  const nowDoing = (names: string[], busy: string, idle: string) =>
    live && lastStep && names.includes(lastStep.step) ? busy : idle;

  const agents: AgentCard[] = [
    {
      id: "orchestrator",
      label: "Orchestrator",
      status: live ? "Running a campaign" : "Ready",
      on: true,
      busy: live,
      role: "Reads your idea and brand card, sets the goal, picks the writers, and keeps the loop to its limits",
      task: live ? `Working on step: ${lastStep?.step ?? "starting"}` : "Waiting for the next idea",
      stats: [
        { label: "Campaigns run", value: String(campaignStats.total) },
        { label: "Last active", value: lastStep ? relativeTime(lastStep.created_at) : "Not yet" },
      ],
      caps: ["Planning", "Picking writers", "Budget of 10 model calls", `Up to ${MAX_REVISION_ROUNDS} revision rounds`],
      last: lastStep ? relativeTime(lastStep.created_at) : "",
    },
    {
      id: "strategy",
      label: "Strategy",
      status: "Ready",
      on: true,
      busy: live && lastStep?.step === "strategy",
      role: "Turns the plan into an angle, a hook and per-platform notes the writers follow",
      task: nowDoing(["strategy"], "Shaping the angle", "Ready for the next plan"),
      stats: [
        { label: "Strategies", value: String(stepCount("strategy")) },
        { label: "Last active", value: lastAt(["strategy"]) },
      ],
      caps: ["Angles", "Hooks", "Platform notes"],
      last: lastAt(["strategy"]),
    },
    {
      id: "research",
      label: "Research",
      status: tavilyConfigured() ? "Ready" : "Off",
      on: tavilyConfigured(),
      busy: live && lastStep?.step === "research",
      role: "Pulls a few live sources before the LinkedIn writer starts, so claims have something behind them",
      task: tavilyConfigured() ? nowDoing(["research"], "Searching the web", "Runs on LinkedIn campaigns") : "Add a Tavily key to switch it on",
      stats: [
        { label: "Searches", value: String(stepCount("research")) },
        { label: "Last active", value: lastAt(["research"]) },
      ],
      caps: ["Live web search", "Up to 5 sources", "LinkedIn only"],
      last: lastAt(["research"]),
    },
    ...Object.values(PLATFORM_PLAYBOOKS).map((p) => {
      const written = activity.filter((a) => a.platform === p.id).length;
      const meta = PLATFORM_ROLE[p.id];
      return {
        id: p.id,
        label: `${p.displayName} writer`,
        status: p.enabled ? (live ? "Writing" : "Ready") : "Coming later",
        on: p.enabled,
        busy: p.enabled && live && (lastStep?.step === "draft" || lastStep?.step === "revise"),
        role: meta?.role ?? `Writes ${p.displayName} posts`,
        task: p.enabled ? nowDoing(["draft", "revise"], "Writing drafts", "Ready for the next brief") : "Switched off in the platform registry",
        stats: [
          { label: "Drafts written", value: String(written) },
          { label: "Character limit", value: p.maxChars.toLocaleString() },
        ],
        caps: meta?.caps ?? [],
        last: p.enabled ? `${written} draft${written === 1 ? "" : "s"}` : "Off",
      } satisfies AgentCard;
    }),
    {
      id: "critic",
      label: "Critic",
      status: "Ready",
      on: true,
      busy: live && lastStep?.step === "critique",
      role: `Scores every draft on brand voice, goal fit, platform fit and craft. Below ${PASS_THRESHOLD.toFixed(2)} goes back to the writer, up to ${MAX_REVISION_ROUNDS} rounds, then to you`,
      task: nowDoing(["critique"], "Scoring drafts", `Passes at ${PASS_THRESHOLD.toFixed(2)}`),
      stats: [
        { label: "Reviews", value: String(stepCount("critique")) },
        { label: "Pass rate", value: passRate },
      ],
      caps: ["Rubric scoring", "Fix lists", "Hard character gate", "Runs on a different model"],
      last: lastAt(["critique"]),
    },
    {
      id: "image",
      label: "Image",
      status: isImageGenerationConfigured() ? "Ready" : "Off",
      on: isImageGenerationConfigured(),
      busy: live && lastStep?.step === "image",
      role: "Makes one image when you don’t upload a photo, then crops it for each platform",
      task: isImageGenerationConfigured() ? nowDoing(["image"], "Making the image", "Used when no photo is uploaded") : "Add an OpenAI key to switch it on",
      stats: [
        { label: "Images made", value: String(stepCount("image")) },
        { label: "Last active", value: lastAt(["image"]) },
      ],
      caps: ["1024 × 1024", "Per-platform crops", "Your photo wins"],
      last: lastAt(["image"]),
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
      <AgentsView
        agents={agents}
        models={{ writer: env.WRITER_MODEL, critic: env.CRITIC_MODEL }}
        writers={Object.values(PLATFORM_PLAYBOOKS)
          .filter((p) => p.enabled)
          .map((p) => p.displayName)}
      />
    </AppShell>
  );
}
