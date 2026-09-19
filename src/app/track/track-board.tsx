"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlatformPill } from "@/components/leno/platform-pill";
import {
  TrackDrawer,
  type TrackDraft,
  type TrackMilestone,
} from "@/components/leno/track-drawer";
import {
  TRACK_STAGES,
  draftStage,
  stageBadgeClass,
  type TrackStage,
} from "@/lib/workspace-ui";
import type { DraftStatus } from "@/shared/types";

export type TrackPost = {
  id: string;
  campaign_id: string;
  platform: string;
  body: string;
  status: DraftStatus;
  score: number | null;
  scheduled_at: string | null;
  campaign_goal: string | null;
  campaign_brief: string;
};

const STEP_COPY: Record<string, string> = {
  plan: "Orchestrator turned the brief into a goal, audience, and channels",
  strategy: "Strategy agent shaped the narrative and hooks",
  draft: "Platform agent generated native copy",
  critique: "Quality critic scored the draft against the rubric",
  revise: "Writer revised after critic feedback",
  error: "Pipeline hit an error and stopped",
};

export function TrackBoard({
  posts,
  stepsByCampaign,
  canMutate,
}: {
  posts: TrackPost[];
  stepsByCampaign: Record<string, { step: string; created_at: string; duration_ms: number }[]>;
  canMutate: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"All" | TrackStage>("All");
  const [open, setOpen] = useState<TrackDraft | null>(null);

  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const s of TRACK_STAGES) next[s] = 0;
    for (const post of posts) next[draftStage(post)] += 1;
    return next;
  }, [posts]);

  const filtered = posts.filter((post) => stage === "All" || draftStage(post) === stage);

  const milestones: TrackMilestone[] = open
    ? (stepsByCampaign[open.campaign_id] ?? []).map((step, idx, arr) => ({
        time: new Date(step.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        text: STEP_COPY[step.step] ?? step.step,
        active: idx === arr.length - 1,
      }))
    : [];

  return (
    <>
      <div className="pipeline-stage-bar">
        <button
          type="button"
          className={`pipeline-stage-pill${stage === "All" ? " active" : ""}`}
          onClick={() => setStage("All")}
        >
          <div className="stage-name-box">
            <span>All Stages</span>
          </div>
        </button>
        {TRACK_STAGES.map((item, idx) => (
          <span key={item} style={{ display: "contents" }}>
            <span className="stage-arrow-separator">→</span>
            <button
              type="button"
              className={`pipeline-stage-pill${stage === item ? " active" : ""}`}
              onClick={() => setStage(item)}
            >
              <div className="stage-name-box">
                <span>
                  {idx + 1}. {item}
                </span>
              </div>
              <span className="stage-count-badge">{counts[item] ?? 0}</span>
            </button>
          </span>
        ))}
      </div>

      <div id="trackingCardsGrid" className="tracking-cards-grid">
        {filtered.length === 0 ? (
          <div className="card">
            <p className="card-title">Nothing in this stage</p>
            <p className="card-subtitle">Generate content, then track it from idea to live.</p>
          </div>
        ) : (
          filtered.map((post) => {
            const current = draftStage(post);
            return (
              <button
                type="button"
                key={post.id}
                className="tracking-card"
                onClick={() => setOpen(post)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <PlatformPill platform={post.platform} />
                  <span className={`badge ${stageBadgeClass(current)}`}>{current}</span>
                </div>
                <p className="content-row-title" style={{ textAlign: "left" }}>
                  {post.campaign_goal ?? post.body.slice(0, 80)}
                </p>
                <p className="card-subtitle" style={{ textAlign: "left" }}>
                  {post.body.slice(0, 140)}
                </p>
              </button>
            );
          })
        )}
      </div>

      <TrackDrawer
        draft={open}
        milestones={milestones}
        canMutate={canMutate}
        onClose={() => setOpen(null)}
        onChanged={() => router.refresh()}
      />
    </>
  );
}
