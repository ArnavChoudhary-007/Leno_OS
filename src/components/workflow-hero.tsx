const STAGES = [
  { title: "Brief", body: "One prompt. A clear goal." },
  { title: "Drafts", body: "On-brand. Native to each channel." },
  { title: "Review", body: "Scored, then you approve." },
] as const;

/** CSS-only 3D stack — no WebGL, pauses when motion is reduced. */
export function WorkflowHero() {
  return (
    <div className="relative mx-auto h-[280px] w-full max-w-[320px]">
      <div className="workflow-scene absolute inset-0 flex items-center justify-center">
        {STAGES.map((stage, index) => (
          <article
            key={stage.title}
            className="workflow-card surface absolute w-[220px] rounded-2xl border border-border p-4"
            style={{
              zIndex: STAGES.length - index,
              marginTop: index * 18,
              marginLeft: index * 14,
              animationDelay: `${index * 0.35}s`,
            }}
          >
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Step {index + 1}
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {stage.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {stage.body}
            </p>
          </article>
        ))}
      </div>
      <span className="sr-only">
        Workflow: brief, drafts, then human review.
      </span>
    </div>
  );
}
