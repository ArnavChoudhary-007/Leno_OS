"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import type { PublishAccess } from "@/components/leno/post-actions";
import { apiErrorMessage } from "@/lib/api-error";
import { platformLabel } from "@/lib/workspace-ui";
import type { CampaignStatus, Plan } from "@/shared/types";
import { DraftCard, type DraftCardData } from "./draft-card";
import { StepTimeline, type TimelineStep } from "./step-timeline";

type CampaignPayload = {
  campaign: {
    id: string;
    brief: string;
    goal: string | null;
    plan: Plan | null;
    status: CampaignStatus;
    created_at: string;
  };
  steps: TimelineStep[];
  drafts: DraftCardData[];
};

const TERMINAL: CampaignStatus[] = ["ready", "needs_human", "failed"];

const STATUS_LABEL: Record<CampaignStatus, string> = {
  queued: "Queued",
  running: "Writing",
  ready: "Ready for review",
  needs_human: "Needs your review",
  failed: "Stopped",
};

function statusBadge(status: CampaignStatus): string {
  if (status === "ready") return "l-badge l-badge-lime";
  if (status === "needs_human") return "l-badge l-badge-light";
  if (status === "failed") return "l-badge l-badge-danger";
  return "l-badge l-badge-outline";
}

/** Strip the machine line Create appends, for display. */
function readableBrief(brief: string): string {
  return brief.replace(/^Platforms:.*$/im, "").trim();
}

export function CampaignView({
  campaignId,
  canMutate,
  publish,
}: {
  campaignId: string;
  canMutate: boolean;
  publish: PublishAccess;
}) {
  const router = useRouter();
  const [data, setData] = useState<CampaignPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const prevStatus = useRef<CampaignStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/sign-in?next=${encodeURIComponent(`/campaigns/${campaignId}`)}`);
          return;
        }
        setError(
          res.status === 404
            ? "Campaign not found"
            : apiErrorMessage(await res.json().catch(() => ({})), `Error ${res.status}`),
        );
        return;
      }
      setData((await res.json()) as CampaignPayload);
      setError(null);
    } catch {
      setError("Could not reach the server. Check your connection.");
    }
  }, [campaignId, router]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const live = data ? !TERMINAL.includes(data.campaign.status) : false;

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => void load(), 1200);
    return () => window.clearInterval(id);
  }, [live, load]);

  useEffect(() => {
    if (!data) return;
    const next = data.campaign.status;
    const prev = prevStatus.current;
    prevStatus.current = next;
    if (!prev || prev === next || !TERMINAL.includes(next)) return;
    if (next === "ready") toast.success("Drafts are ready to review");
    else if (next === "needs_human") toast("Drafts are ready — some need a closer look");
    else toast.error("The run stopped. Check the error in the timeline");
  }, [data]);

  async function retry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: "POST" });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(apiErrorMessage(json, `Retry failed (${res.status})`));
        return;
      }
      toast.success("Running it again");
      prevStatus.current = "queued";
      await load();
    } finally {
      setRetrying(false);
    }
  }

  if (error) {
    return (
      <EmptyState
        title={error}
        description="Try again, or start fresh from a new idea."
        action={
          <>
            <button type="button" className="l-btn l-btn-outline" onClick={() => void load()}>
              Try again
            </button>
            <Link href="/campaigns/new" className="l-btn l-btn-ghost">
              Write a new post
            </Link>
          </>
        }
      />
    );
  }

  if (!data) {
    return (
      <div className="l-stack-18" aria-busy="true">
        <span className="l-skel" style={{ width: 120, height: 14 }} />
        <span className="l-skel" style={{ width: "60%", height: 64 }} />
        <span className="l-skel" style={{ width: "100%", height: 160 }} />
      </div>
    );
  }

  const { campaign, steps, drafts } = data;
  const canRetry = canMutate && TERMINAL.includes(campaign.status);

  return (
    <>
      <div className="l-page-header">
        <div className="l-page-header-text">
          <Link href="/campaigns" className="l-link" style={{ alignSelf: "flex-start" }}>
            ← Content
          </Link>
          <h1 className="l-h2" style={{ fontSize: "clamp(36px, 4.5vw, 64px)" }}>
            {campaign.goal ?? "Campaign run"}
          </h1>
          <span style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span className={statusBadge(campaign.status)}>{STATUS_LABEL[campaign.status]}</span>
            <span className="l-faint" style={{ fontSize: 14 }}>
              Started {new Date(campaign.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
          </span>
        </div>
        {canRetry ? (
          <div className="l-page-header-actions">
            <button type="button" className="l-btn l-btn-outline" disabled={retrying} onClick={() => void retry()}>
              {retrying ? "Starting…" : "Run it again"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="l-run-grid">
        <div className="l-stack-24">
          <section className="l-card l-stack-12">
            <h2 className="l-card-title">The idea</h2>
            <p className="l-quote" style={{ maxHeight: "none" }}>
              {readableBrief(campaign.brief)}
            </p>
          </section>

          {campaign.plan ? (
            <section className="l-card l-stack-12">
              <h2 className="l-card-title">The plan</h2>
              <dl className="l-plan">
                {(
                  [
                    ["Goal", campaign.plan.goal],
                    ["Audience", campaign.plan.audience],
                    ["Key message", campaign.plan.key_message],
                    ["Platforms", campaign.plan.platforms.map(platformLabel).join(", ")],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : live ? (
            <section className="l-card l-stack-12">
              <h2 className="l-card-title">The plan</h2>
              <span className="l-skel" style={{ height: 56 }} />
              <span className="l-skel" style={{ height: 56, width: "70%" }} />
            </section>
          ) : null}

          <section aria-labelledby="drafts-h" className="l-stack-12">
            <h2 id="drafts-h" className="l-card-title">
              Posts{drafts.length ? ` · ${drafts.length}` : ""}
            </h2>
            {drafts.length === 0 ? (
              live ? (
                <div className="l-stack-12">
                  <span className="l-skel" style={{ height: 160 }} />
                  <p className="l-muted" style={{ margin: 0 }}>
                    Posts land here as the writers finish.
                  </p>
                </div>
              ) : (
                <EmptyState
                  title="No posts from this run"
                  description="It finished without drafts. Run it again, or start from a clearer idea."
                />
              )
            ) : (
              drafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  live={live}
                  canMutate={canMutate}
                  publish={publish}
                  onChanged={load}
                />
              ))
            )}
          </section>
        </div>

        <aside className="l-card l-run-side" aria-label="Pipeline">
          <h2 className="l-card-title" style={{ marginBottom: 16 }}>
            Pipeline
          </h2>
          <StepTimeline steps={steps} live={live} />
        </aside>
      </div>
    </>
  );
}
