"use client";

import type { RunStepName } from "@/shared/types";

const STEP_LABEL: Record<RunStepName, string> = {
  load_context: "Read the brief and brand",
  plan: "Plan",
  strategy: "Strategy",
  roster: "Picked the writers",
  research: "Research",
  draft: "Drafts written",
  image: "Image",
  critique: "Critic scored",
  revise: "Revised",
  summary: "Handed to you",
  error: "Error",
};

export type TimelineStep = {
  id: string;
  step: string;
  model: string;
  duration_ms: number;
  created_at: string;
  output: unknown;
};

export function StepTimeline({ steps, live }: { steps: TimelineStep[]; live: boolean }) {
  if (steps.length === 0) {
    return <p className="l-muted" style={{ margin: 0 }}>Waiting for the first step…</p>;
  }

  return (
    <ol className="l-timeline">
      {steps.map((step, index) => {
        const label = STEP_LABEL[step.step as RunStepName] ?? step.step;
        const isError = step.step === "error";
        const isLast = index === steps.length - 1;
        const message =
          isError &&
          step.output &&
          typeof step.output === "object" &&
          "message" in step.output &&
          typeof step.output.message === "string"
            ? step.output.message
            : null;
        const tone = isError ? "error" : isLast && live ? "now" : "done";
        return (
          <li key={step.id} className={`l-tl is-${tone}`}>
            <span className="l-tl-time">
              {new Date(step.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
            <span aria-hidden="true" className="l-tl-rail">
              <span className="l-tl-dot" />
              {!isLast ? <span className="l-tl-line" /> : null}
            </span>
            <span className="l-tl-text">
              {label}
              <span className="l-faint mono" style={{ fontSize: 12, marginLeft: 8 }}>
                {step.model === "-" ? "code" : step.model} · {(step.duration_ms / 1000).toFixed(1)}s
              </span>
              {message ? (
                <span style={{ display: "block", marginTop: 4, fontSize: 14 }}>{message}</span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
