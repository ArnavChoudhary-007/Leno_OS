"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { composePost } from "@/agents/platforms";
import { CloseIcon } from "@/components/app-chrome";
import { Drawer } from "@/components/leno/drawer";
import { PostActions, destinationFor, type PublishAccess } from "@/components/leno/post-actions";
import {
  POST_STAGES,
  platformLabel,
  postStage,
  postTitle,
  relativeTime,
  shortDateTime,
  type PostStage,
} from "@/lib/workspace-ui";
import type { DraftStatus, PlatformId } from "@/shared/types";

export type TrackPost = {
  id: string;
  campaign_id: string;
  platform: string;
  version: number;
  body: string;
  hashtags: string[];
  status: DraftStatus;
  score: number | null;
  scheduled_at: string | null;
  published_url: string | null;
  review_note: string | null;
  created_at: string;
  campaign_goal: string | null;
  campaign_brief: string;
};

export type TrackStep = { step: string; phase: string | null; created_at: string };

const STEP_COPY: Record<string, string> = {
  load_context: "Orchestrator read the brief and the brand card",
  plan: "Planner set the goal, audience and platforms",
  strategy: "Strategy agent picked the angle and hooks",
  research: "Research agent pulled live sources",
  roster: "Orchestrator picked the platform writers",
  draft: "Platform writers drafted every post",
  image: "Image made and cropped per platform",
  critique: "Critic scored the drafts against the rubric",
  revise: "Writer revised after the critic’s notes",
  summary: "Run finished and handed the posts to you",
  error: "The run hit an error and stopped",
};

const STAGE_NOTE: Record<PostStage, string> = {
  Drafted: "Waiting for your approval",
  Flagged: "Critic couldn’t pass it in 3 rounds, waiting for you",
  "Changes requested": "Sent back with your note",
  Approved: "Approved, not scheduled yet",
  Scheduled: "Scheduled",
  Published: "Live",
};

const ago = (iso: string) => relativeTime(iso);

export function TrackBoard({
  posts,
  stepsByCampaign,
  canMutate,
  publish,
  initialOpen,
}: {
  posts: TrackPost[];
  stepsByCampaign: Record<string, TrackStep[]>;
  canMutate: boolean;
  publish: PublishAccess;
  initialOpen?: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<PostStage | null>(null);
  const [openId, setOpenId] = useState<string | null>(
    initialOpen && posts.some((p) => p.id === initialOpen) ? initialOpen : null,
  );

  const counts = useMemo(() => {
    const next = Object.fromEntries(POST_STAGES.map((s) => [s, 0])) as Record<PostStage, number>;
    for (const p of posts) next[postStage(p)] += 1;
    return next;
  }, [posts]);

  const shown = posts.filter((p) => stage === null || postStage(p) === stage);
  const open = posts.find((p) => p.id === openId) ?? null;

  return (
    <>
      <ol aria-label="Lifecycle" className="l-life">
        {POST_STAGES.map((s) => {
          const on = stage === s;
          return (
            <li key={s}>
              <button
                type="button"
                className="l-life-btn"
                aria-pressed={on}
                onClick={() => setStage(on ? null : s)}
              >
                <span className="l-num" style={{ fontSize: 44 }}>
                  {counts[s]}
                </span>
                <span className="l-life-label">{s}</span>
                <span aria-hidden="true" className={`l-life-bar${counts[s] ? " has" : ""}`} />
              </button>
            </li>
          );
        })}
      </ol>
      <p className="l-faint" style={{ margin: "-16px 0 0", fontSize: 14 }} aria-live="polite">
        {stage ? `Showing ${shown.length} ${stage.toLowerCase()} post${shown.length === 1 ? "" : "s"}. Press it again to see everything.` : `Showing all ${posts.length} posts. Pick a stage to narrow it down.`}
      </p>

      {shown.length === 0 ? (
        <p className="l-faint" style={{ margin: 0, padding: "32px 0", fontSize: 16 }}>
          Nothing at this stage right now
        </p>
      ) : (
        <div className="l-track-grid">
          {shown.map((p) => {
            const st = postStage(p);
            const last =
              st === "Scheduled" && p.scheduled_at
                ? `Goes live ${shortDateTime(p.scheduled_at)}`
                : STAGE_NOTE[st];
            return (
              <button key={p.id} type="button" className="l-track-card" onClick={() => setOpenId(p.id)}>
                <span className="l-track-meta">
                  <span>
                    {platformLabel(p.platform)} · {st}
                  </span>
                  <span>{ago(p.created_at)}</span>
                </span>
                <span className="l-track-title">{postTitle(p)}</span>
                <span className="l-track-last">{last}</span>
                <span className="l-link-lime" style={{ fontSize: 14 }}>
                  See full history
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Drawer open={open !== null} onClose={() => setOpenId(null)} label="Post history">
        {open ? (
          <TrackDetail
            post={open}
            steps={stepsByCampaign[open.campaign_id] ?? []}
            canMutate={canMutate}
            publish={publish}
            onClose={() => setOpenId(null)}
            onChanged={() => router.refresh()}
          />
        ) : null}
      </Drawer>
    </>
  );
}

function TrackDetail({
  post,
  steps,
  canMutate,
  publish,
  onClose,
  onChanged,
}: {
  post: TrackPost;
  steps: TrackStep[];
  canMutate: boolean;
  publish: PublishAccess;
  onClose: () => void;
  onChanged: () => void;
}) {
  const st = postStage(post);
  const timeline: { time: string; text: string; tone: "done" | "now" | "error" }[] = [];

  // One line per kind of step: critique/revise rounds and the plan's
  // two log rows (goal, then full plan) collapse into their first entry.
  const seen = new Set<string>();
  for (const s of steps) {
    if (seen.has(s.step)) continue;
    seen.add(s.step);
    timeline.push({
      time: new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      text: STEP_COPY[s.step] ?? s.step,
      tone: s.step === "error" ? "error" : "done",
    });
  }
  if (post.version > 1) {
    timeline.push({
      time: new Date(post.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      text: `Version ${post.version} written${post.review_note ? `: “${post.review_note}”` : ""}`,
      tone: "done",
    });
  }
  if (st === "Scheduled" && post.scheduled_at) {
    timeline.push({ time: "Next", text: `Publishes to ${destinationFor(post.platform)} ${shortDateTime(post.scheduled_at)}`, tone: "now" });
  } else if (st === "Published") {
    timeline.push({ time: "Done", text: `Live on ${destinationFor(post.platform)}`, tone: "now" });
  } else {
    timeline.push({ time: "Now", text: STAGE_NOTE[st], tone: "now" });
  }

  const text = composePost({ platform: post.platform as PlatformId, body: post.body, hashtags: post.hashtags });

  return (
    <>
      <div className="l-drawer-head">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="l-muted" style={{ fontSize: 14 }}>
            {platformLabel(post.platform)} · {st}
            {post.score != null ? ` · score ${post.score.toFixed(2)}` : ""}
          </span>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 600, lineHeight: 1.25 }}>{postTitle(post)}</h2>
        </div>
        <button type="button" className="l-icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <p className="l-quote">{text}</p>
      <section aria-label="History">
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>History</h3>
        <ol className="l-timeline">
          {timeline.map((t, i) => (
            <li key={`${t.time}-${i}`} className={`l-tl is-${t.tone}`}>
              <span className="l-tl-time">{t.time}</span>
              <span aria-hidden="true" className="l-tl-rail">
                <span className="l-tl-dot" />
                {i < timeline.length - 1 ? <span className="l-tl-line" /> : null}
              </span>
              <span className="l-tl-text">{t.text}</span>
            </li>
          ))}
        </ol>
      </section>
      <PostActions draft={post} canMutate={canMutate} publish={publish} onChanged={onChanged} />
      <Link href={`/campaigns/${post.campaign_id}`} className="l-link" style={{ alignSelf: "flex-start" }}>
        Open the full run
      </Link>
    </>
  );
}
