"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import type { CampaignStatus, Plan, PublishDestinations } from "@/shared/types";
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
  destinations?: PublishDestinations;
};

const TERMINAL: CampaignStatus[] = ["ready", "needs_human", "failed"];

function statusLabel(status: CampaignStatus): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "ready":
      return "Ready for review";
    case "needs_human":
      return "Needs your review";
    case "failed":
      return "Failed";
  }
}

function statusVariant(
  status: CampaignStatus,
): "default" | "success" | "warning" | "danger" | "live" {
  switch (status) {
    case "queued":
      return "default";
    case "running":
      return "live";
    case "ready":
      return "success";
    case "needs_human":
      return "warning";
    case "failed":
      return "danger";
  }
}

function CampaignSkeleton() {
  return (
    <div>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Skeleton className="mt-8 h-28 w-full rounded-2xl" />
      <div className="mt-8 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-5/6" />
      </div>
      <Skeleton className="mt-10 h-40 w-full rounded-2xl" />
    </div>
  );
}

export function CampaignView({ campaignId }: { campaignId: string }) {
  const [data, setData] = useState<CampaignPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const prevStatus = useRef<CampaignStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.assign(
            `/sign-in?next=${encodeURIComponent(`/campaigns/${campaignId}`)}`,
          );
          return;
        }
        setError(
          res.status === 404
            ? "Campaign not found"
            : apiErrorMessage(
                await res.json().catch(() => ({})),
                `Error ${res.status}`,
              ),
        );
        return;
      }
      const json = (await res.json()) as CampaignPayload;
      setData(json);
      setError(null);
    } catch {
      setError("Could not reach the server — check your connection.");
    }
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    if (TERMINAL.includes(data.campaign.status)) return;

    const id = window.setInterval(() => {
      void load();
    }, 1000);
    return () => window.clearInterval(id);
  }, [data, load]);

  useEffect(() => {
    if (!data) return;
    const next = data.campaign.status;
    const prev = prevStatus.current;
    prevStatus.current = next;
    if (!prev || prev === next) return;
    if (!TERMINAL.includes(next)) return;

    if (next === "ready") {
      toast.success("Pipeline finished — drafts are ready to review");
    } else if (next === "needs_human") {
      toast.message("Pipeline finished — some drafts need your review");
    } else if (next === "failed") {
      toast.error("Campaign failed — check the pipeline error step");
    }
  }, [data]);

  async function retry() {
    setRetrying(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "POST",
      });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = apiErrorMessage(json, `Retry failed (${res.status})`);
        toast.error(message);
        return;
      }
      toast.success("Campaign re-queued");
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
        description="You can try again, or start a fresh run from a new brief."
        action={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                void load();
              }}
            >
              Try again
            </Button>
            <Link
              href="/campaigns/new"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              New campaign
            </Link>
          </>
        }
      />
    );
  }

  if (!data) {
    return <CampaignSkeleton />;
  }

  const { campaign, steps, drafts } = data;
  const live = !TERMINAL.includes(campaign.status);

  return (
    <div className="track-page-container">
      <header className="track-header">
        <div>
          <h1 className="track-title">Live run</h1>
          <p className="track-subtitle">
            Brief, plan, pipeline, then drafts — nothing publishes until you say so.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant(campaign.status)} live={live}>
            {statusLabel(campaign.status)}
          </Badge>
          {(campaign.status === "failed" ||
            campaign.status === "needs_human" ||
            campaign.status === "ready") && (
            <Button
              size="sm"
              variant="outline"
              disabled={retrying}
              onClick={() => void retry()}
            >
              {retrying ? "Retrying…" : "Retry run"}
            </Button>
          )}
        </div>
      </header>

      <section className="card">
        <h2 className="card-title">Brief</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {campaign.brief}
        </p>
      </section>

      {campaign.plan ? (
        <section>
          <h2 className="module-title">Plan</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Goal", campaign.plan.goal],
                ["Audience", campaign.plan.audience],
                ["Key message", campaign.plan.key_message],
                ["Platforms", campaign.plan.platforms.join(", ")],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="card" style={{ padding: 16 }}>
                <dt className="section-micro-label">{label}</dt>
                <dd className="mt-1 text-sm leading-relaxed">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : live ? (
        <section>
          <h2 className="module-title">Plan</h2>
          <div className="mt-3 space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-2/3 rounded-xl" />
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="card-title">Pipeline</h2>
        <div className="mt-4">
          <StepTimeline steps={steps} />
        </div>
      </section>

      <section>
        <h2 className="module-title">
          Drafts{drafts.length ? ` · ${drafts.length}` : ""}
        </h2>
        {drafts.length === 0 ? (
          live ? (
            <div className="mt-4 grid gap-4">
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-36 w-full rounded-2xl" />
              <p className="text-sm text-muted-foreground">
                Drafts land here as the writer finishes each channel.
              </p>
            </div>
          ) : (
            <EmptyState
              className="mt-4"
              title="No drafts for this campaign"
              description="The run finished without drafts. Retry the pipeline, or start from a clearer brief."
            />
          )
        ) : (
          <div className="mt-4 grid gap-4">
            {drafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                destinations={data.destinations}
                onChanged={load}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
