"use client";

import type { RunStepName } from "@/shared/types";

const STEP_LABEL: Record<RunStepName, string> = {
  plan: "Plan",
  strategy: "Strategy",
  research: "Research",
  draft: "Draft",
  image: "Image",
  critique: "Critique",
  revise: "Revise",
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

export function StepTimeline({ steps }: { steps: TimelineStep[] }) {
  if (steps.length === 0) {
    return (
      <p className="card-subtitle">Waiting for the first pipeline step…</p>
    );
  }

  const last = steps[steps.length - 1];

  return (
    <>
      <div className="pipeline-stage-bar" style={{ marginBottom: 16 }}>
        {steps.map((step) => {
          const label = STEP_LABEL[step.step as RunStepName] ?? step.step;
          return (
            <div
              key={step.id}
              className={`pipeline-stage-pill${step.id === last?.id ? " active" : ""}`}
            >
              <span className="stage-name-box">{label}</span>
              <span className="stage-count-badge">{step.duration_ms}ms</span>
            </div>
          );
        })}
      </div>
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const label = STEP_LABEL[step.step as RunStepName] ?? step.step;
        const isError = step.step === "error";
        const message =
          isError &&
          step.output &&
          typeof step.output === "object" &&
          "message" in step.output &&
          typeof step.output.message === "string"
            ? step.output.message
            : null;

        return (
          <li key={step.id} className="flex gap-3">
            <div className="flex w-5 flex-col items-center">
              <span
                className={`mt-1.5 size-2.5 rounded-full ${
                  isError ? "bg-destructive" : "bg-success"
                }`}
              />
              {index < steps.length - 1 ? (
                <span className="mt-1 w-px flex-1 bg-border" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pb-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium">{label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {step.model === "-" ? "—" : step.model}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {step.duration_ms}ms
                </span>
              </div>
              {message ? (
                <p className="mt-1 text-xs text-destructive">{message}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
    </>
  );
}
