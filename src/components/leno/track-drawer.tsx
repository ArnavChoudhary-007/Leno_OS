"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/leno/drawer";
import { PlatformPill } from "@/components/leno/platform-pill";
import { reviewDraftOrThrow } from "@/lib/review-draft";
import { draftStage, stageBadgeClass } from "@/lib/workspace-ui";
import type { DraftStatus } from "@/shared/types";

export type TrackMilestone = {
  time: string;
  text: string;
  active?: boolean;
};

export type TrackDraft = {
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

export function TrackDrawer({
  draft,
  milestones,
  canMutate,
  onClose,
  onChanged,
}: {
  draft: TrackDraft | null;
  milestones: TrackMilestone[];
  canMutate: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const stage = draft
    ? draftStage({
        status: draft.status,
        scheduled_at: draft.scheduled_at,
        score: draft.score,
      })
    : "Generated";

  function run(label: string, fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <Drawer open={Boolean(draft)} onClose={onClose}>
      {draft ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Lifecycle Audit Trail
              </span>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginTop: 2 }}>
                {draft.campaign_goal ?? draft.campaign_brief.slice(0, 72)}
              </h3>
            </div>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <div className="tracking-drawer-content">
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                  display: "block",
                }}
              >
                Current Status
              </span>
              <span className={`badge ${stageBadgeClass(stage)}`}>{stage}</span>
            </div>
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 8,
                  display: "block",
                }}
              >
                Asset Summary
              </span>
              <div className="card" style={{ padding: 14 }}>
                <PlatformPill platform={draft.platform} />
                <p style={{ marginTop: 8, fontSize: "0.88rem", lineHeight: 1.5 }}>
                  {draft.body.slice(0, 280)}
                  {draft.body.length > 280 ? "…" : ""}
                </p>
              </div>
            </div>
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 12,
                  display: "block",
                }}
              >
                Human-Readable Execution Milestones
              </span>
              <div className="tracking-timeline-box">
                {milestones.length === 0 ? (
                  <p className="card-subtitle">No pipeline steps logged yet.</p>
                ) : (
                  milestones.map((item, idx) => (
                    <div
                      key={`${item.time}-${idx}`}
                      className={`timeline-event-item${item.active ? " active" : " completed"}`}
                    >
                      <span className="timeline-event-time">{item.time}</span>
                      <span className="timeline-event-title">{item.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            {canMutate ? (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: "auto",
                  paddingTop: 16,
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={pending}
                  onClick={() =>
                    run("Approved", () =>
                      reviewDraftOrThrow(draft.campaign_id, draft.id, {
                        action: "approve",
                      }),
                    )
                  }
                >
                  Approve Post
                </button>
                <a
                  href={`/campaigns/${draft.campaign_id}`}
                  className="btn btn-secondary"
                  style={{ flex: 1, textAlign: "center" }}
                >
                  Open campaign
                </a>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
