"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Drawer } from "@/components/leno/drawer";
import { EditorDrawer, type EditorDraft } from "@/components/leno/editor-drawer";
import { PlatformPill } from "@/components/leno/platform-pill";
import { apiErrorMessage } from "@/lib/api-error";
import { reviewDraftOrThrow } from "@/lib/review-draft";
import { platformLabel } from "@/lib/workspace-ui";
import type { CampaignStatus, PlatformId } from "@/shared/types";

const SAMPLE =
  "Why most companies don't have a content problem.\nThey have a distribution problem.";

const PIPELINE = [
  {
    title: "Understanding your idea",
    sub: "Extracting core premises, hook opportunities, and positioning",
    steps: ["plan"],
  },
  {
    title: "Researching",
    sub: "Analyzing industry references and benchmark patterns",
    steps: ["plan"],
  },
  {
    title: "Building content strategy",
    sub: "Structuring narrative arc and high-retention frameworks",
    steps: ["strategy"],
  },
  {
    title: "Adapting for platforms",
    sub: "Generating native long-form, carousel briefs, and thread hooks",
    steps: ["draft"],
  },
  {
    title: "Generating the image",
    sub: "GPT Image 1.5 at 1024×1024, then cropped per platform",
    steps: ["image"],
  },
  {
    title: "Quality checking",
    sub: "Validating critic scorecards and brand tone consistency",
    steps: ["critique", "revise"],
  },
] as const;

const PLATFORMS: {
  id: PlatformId;
  spec: string;
  variant: string;
  preview: string;
  color: string;
}[] = [
  {
    id: "linkedin",
    spec: "Professional post",
    variant: "Long-form",
    preview: "Produces a 1,200 char narrative + structural framework",
    color: "#0A66C2",
  },
  {
    id: "instagram",
    spec: "Carousel + caption",
    variant: "Visual slides",
    preview: "Produces a slide breakdown + visual copy + caption",
    color: "#E1306C",
  },
  {
    id: "x",
    spec: "Short-form",
    variant: "Hook + thread",
    preview: "Produces a hook tweet + connected insight posts",
    color: "#000000",
  },
  {
    id: "threads",
    spec: "Conversational",
    variant: "Reply-native",
    preview: "Produces a casual take that invites replies",
    color: "#1c1c1c",
  },
];

type Source = "idea" | "source" | "campaign" | "repurpose";

export function BriefForm({
  brandName,
  toneWords,
  audience,
}: {
  brandName?: string | null;
  toneWords?: string[];
  audience?: string | null;
}) {
  const [source, setSource] = useState<Source>("idea");
  const [idea, setIdea] = useState(SAMPLE);
  const [topic, setTopic] = useState("Distribution");
  const [topics, setTopics] = useState(["AI Architecture", "Sub-Agents", "Distribution"]);
  const [selectedAudience, setSelectedAudience] = useState(
    audience?.split(/[,.]/)[0]?.trim() || "Founders",
  );
  const [audiences, setAudiences] = useState(
    audience
      ? [audience.split(/[,.]/)[0]?.trim() || audience, "Founders", "Marketers"].filter(
          (v, i, arr) => v && arr.indexOf(v) === i,
        )
      : ["Founders", "Marketers", "Engineers"],
  );
  const [goal, setGoal] = useState("Awareness");
  const [goals, setGoals] = useState(["Awareness", "Engagement", "Leads"]);
  const [tone, setTone] = useState(toneWords?.[0] ?? "Professional");
  const [tones, setTones] = useState(
    toneWords && toneWords.length > 0 ? toneWords : ["Professional", "Conversational", "Bold"],
  );
  const [format, setFormat] = useState("Educational");
  const [platforms, setPlatforms] = useState<PlatformId[]>(["linkedin", "instagram", "x"]);
  const [research, setResearch] = useState("standard");
  const [creativity, setCreativity] = useState(0.7);
  const [length, setLength] = useState("medium");
  const [includeResearch, setIncludeResearch] = useState(true);
  const [brandVoice, setBrandVoice] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [lastStep, setLastStep] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EditorDraft[]>([]);
  const [editing, setEditing] = useState<EditorDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const words = idea.trim() ? idea.trim().split(/\s+/).length : 0;
  const generating = Boolean(campaignId) && status !== "ready" && status !== "needs_human" && status !== "failed";
  const done = status === "ready" || status === "needs_human";

  const stepIndex = useMemo(() => {
    if (!lastStep) return generating ? 0 : -1;
    const idx = PIPELINE.findIndex((s) => s.steps.includes(lastStep as never));
    if (lastStep === "error") return PIPELINE.length - 1;
    return idx < 0 ? 0 : idx;
  }, [lastStep, generating]);

  useEffect(() => {
    if (!campaignId || done || status === "failed") return;
    const id = window.setInterval(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        campaign: { status: CampaignStatus };
        steps: { step: string }[];
        drafts: EditorDraft[];
      };
      setStatus(json.campaign.status);
      setLastStep(json.steps[json.steps.length - 1]?.step ?? null);
      setDrafts(json.drafts ?? []);
    }, 1000);
    return () => window.clearInterval(id);
  }, [campaignId, done, status]);

  function togglePlatform(id: PlatformId) {
    setPlatforms((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          toast.error("At least one platform must be selected");
          return prev;
        }
        return prev.filter((p) => p !== id);
      }
      return [...prev, id];
    });
  }

  function addChip(list: string[], setList: (v: string[]) => void, setActive: (v: string) => void, label: string) {
    const value = window.prompt(label)?.trim();
    if (!value) return;
    setList([...list, value]);
    setActive(value);
  }

  function composeBrief(): string {
    const extra = [
      idea.trim(),
      "",
      `Topic: ${topic}. Audience: ${selectedAudience}. Goal: ${goal}. Tone: ${tone}. Format: ${format}.`,
      `Write only for: ${platforms.map(platformLabel).join(", ")}.`,
      `Length: ${length}. Creativity: ${creativity}. Research: ${research}${includeResearch ? " with citations where useful" : ""}.`,
      brandVoice ? "Stay strictly on brand voice." : "",
      source !== "idea" ? `Creation mode: ${source}.` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return extra.slice(0, 2000);
  }

  function generate() {
    setError(null);
    startTransition(async () => {
      const body = new FormData();
      body.set("brief", composeBrief());
      if (image) body.set("image", image);
      const res = await fetch("/api/campaigns", { method: "POST", body });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = apiErrorMessage(data, `Request failed (${res.status})`);
        setError(message);
        toast.error(message);
        return;
      }
      if (data && typeof data === "object" && "id" in data && typeof data.id === "string") {
        setCampaignId(data.id);
        setStatus("queued");
        setDrafts([]);
        toast.success("Orchestrator started");
        return;
      }
      setError("Unexpected response");
    });
  }

  function approveAll() {
    startTransition(async () => {
      try {
        for (const draft of drafts) {
          if (draft.status === "published") continue;
          await reviewDraftOrThrow(draft.campaign_id, draft.id, { action: "approve" });
        }
        toast.success("Approved all drafts");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Approve failed");
      }
    });
  }

  const placeholder =
    source === "source"
      ? "Paste a whitepaper link, raw notes, or article excerpt..."
      : source === "campaign"
        ? "Define a multi-day campaign arc..."
        : source === "repurpose"
          ? "Paste a high-performing past post or URL to adapt..."
          : "Describe the idea in a few words...";

  return (
    <div className="create-container">
      <div className="create-cockpit-header">
        <h1 className="create-cockpit-title">Create content</h1>
        <p className="create-cockpit-subtitle">Turn an idea into platform-ready content.</p>
      </div>

      <div className="creation-type-section">
        <span className="section-micro-label">Start with</span>
        <div className="creation-type-row" role="radiogroup">
          {(
            [
              ["idea", "Idea", "Start from a thought"],
              ["source", "Source", "Turn existing material into content"],
              ["campaign", "Campaign", "Build a multi-post narrative"],
              ["repurpose", "Repurpose", "Adapt existing content"],
            ] as const
          ).map(([id, name, hint]) => (
            <button
              key={id}
              type="button"
              className={`creation-type-pill${source === id ? " active" : ""}`}
              onClick={() => setSource(id)}
            >
              <span className="creation-type-texts">
                <span className="creation-type-name">{name}</span>
                <span className="creation-type-hint">{hint}</span>
              </span>
              <span className="creation-type-dot" />
            </button>
          ))}
        </div>
      </div>

      <div className="create-cockpit-grid" id="createCockpitWorkspace" style={generating ? { opacity: 0.5 } : undefined}>
        <aside className="cockpit-col cockpit-context-col">
          <div className="cockpit-panel-header">
            <span className="cockpit-panel-title">Context</span>
          </div>
          <ChipGroup
            label="Topic"
            values={topics}
            active={topic}
            onSelect={setTopic}
            onAdd={() => addChip(topics, setTopics, setTopic, "Enter topic")}
          />
          <ChipGroup
            label="Audience"
            values={audiences}
            active={selectedAudience}
            onSelect={setSelectedAudience}
            onAdd={() => addChip(audiences, setAudiences, setSelectedAudience, "Enter audience")}
          />
          <ChipGroup
            label="Goal"
            values={goals}
            active={goal}
            onSelect={setGoal}
            onAdd={() => addChip(goals, setGoals, setGoal, "Enter goal")}
          />
          <ChipGroup
            label="Tone"
            values={tones}
            active={tone}
            onSelect={setTone}
            onAdd={() => addChip(tones, setTones, setTone, "Enter tone")}
          />
          {brandName ? (
            <div className="context-group">
              <p className="context-group-label">Brand</p>
              <span className="context-chip active">{brandName}</span>
            </div>
          ) : null}
        </aside>

        <main className="cockpit-col cockpit-canvas-col">
          <div className="canvas-header">
            <div className="canvas-title-wrap">
              <span className="cockpit-panel-title">Your idea</span>
              <span className="canvas-caption">What do you want to say?</span>
            </div>
            <button
              type="button"
              className="btn-enhance-ai"
              onClick={() => {
                if (!idea.trim()) {
                  toast.error("Write a few words first");
                  return;
                }
                setIdea(
                  `The single biggest bottleneck isn't more posts — it's un-orchestrated distribution.\n\n${idea.trim()}\n\nSpecialist agents with typed contracts beat a single prompt chain.`,
                );
                toast.success("Idea sharpened");
              }}
            >
              Enhance with AI
            </button>
          </div>
          <div className="canvas-writing-surface">
            <textarea
              className="canvas-textarea"
              rows={6}
              value={idea}
              placeholder={placeholder}
              onChange={(e) => setIdea(e.target.value)}
              maxLength={1600}
              disabled={pending || generating}
            />
            <div className="canvas-footer-stats">
              <span className="canvas-word-count">{words} words</span>
            </div>
          </div>
          <div className="ai-suggestions-bar">
            <span className="suggestions-label">AI suggestions</span>
            <div className="suggestions-chips">
              <button
                type="button"
                className="suggestion-chip"
                onClick={() => {
                  setIdea(`The distribution layer is the product.\n\n${idea}`);
                  toast.message("Added a hook");
                }}
              >
                Add a hook
              </button>
              <button
                type="button"
                className="suggestion-chip"
                onClick={() => {
                  setIdea(idea.replace(/\bvery\b/gi, "").replace(/\breally\b/gi, "").replace(/  +/g, " ").trim());
                  toast.message("Tightened the copy");
                }}
              >
                Make it sharper
              </button>
              <button
                type="button"
                className="suggestion-chip"
                onClick={() => {
                  if (!idea.includes("Contrarian")) {
                    setIdea(
                      `${idea}\n\nContrarian angle: the future of distribution isn't writing more posts — it's deploying specialist agents with verification contracts.`,
                    );
                  }
                  toast.message("Added a contrarian angle");
                }}
              >
                Add a contrarian angle
              </button>
            </div>
          </div>
        </main>

        <aside className="cockpit-col cockpit-distribute-col">
          <div className="cockpit-panel-header">
            <span className="cockpit-panel-title">Distribute to</span>
            <span className="cockpit-panel-meta">{platforms.length} selected</span>
          </div>
          <div className="distribution-cards-list">
            {PLATFORMS.map((item) => {
              const selected = platforms.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`platform-module-card${selected ? " selected" : ""}`}
                  onClick={() => togglePlatform(item.id)}
                >
                  <div className="platform-module-top">
                    <div className="platform-module-identity">
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          background: item.color,
                          display: "inline-block",
                        }}
                      />
                      <span className="platform-module-name">{platformLabel(item.id)}</span>
                    </div>
                    <span className="platform-module-toggle">
                      <span className="toggle-dot" />
                      <span className="toggle-text">{selected ? "Selected" : "Off"}</span>
                    </span>
                  </div>
                  <div className="platform-module-spec">
                    <span className="spec-format">{item.spec}</span>
                    <span className="spec-sep">•</span>
                    <span className="spec-variant">{item.variant}</span>
                  </div>
                  <div className="platform-module-output-preview">{item.preview}</div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <div className="content-intelligence-bar">
        <div className="intelligence-left-group">
          <div className="intelligence-badge">Content strategy</div>
          <div className="intelligence-metrics">
            <Intel label="Purpose" value={goal} />
            <div className="intel-divider" />
            <Intel label="Audience" value={selectedAudience} />
            <div className="intel-divider" />
            <Intel label="Tone" value={tone} />
            <div className="intel-divider" />
            <Intel label="Format" value={format} />
          </div>
        </div>
        <button type="button" className="btn-adjust-strategy" onClick={() => setStrategyOpen(true)}>
          Adjust strategy
        </button>
      </div>

      <div className="create-command-bar">
        <div className="command-bar-left">
          <span className="command-bar-status-dot" />
          <div className="command-bar-summary">
            <span className="command-bar-title">{generating ? "Generating…" : "Ready to create"}</span>
            <span className="command-bar-subtitle">
              {platforms.length} platforms • 1 core idea • {includeResearch ? "AI research enabled" : "Fast generation"}
            </span>
          </div>
        </div>
        <div className="command-bar-right">
          <button type="button" className="btn btn-subtle" onClick={() => setAdvancedOpen(true)}>
            Advanced controls
          </button>
          <button
            type="button"
            className="btn-generate-cta"
            disabled={pending || generating || idea.trim().length < 20}
            onClick={generate}
          >
            {pending ? "Starting…" : "Generate content"}
          </button>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className={`ai-generation-overlay${generating || done ? " active" : ""}`}>
        <div className="generation-header">
          <div>
            <h3 className="generation-title">Generating Platform Content</h3>
            <p className="generation-subtitle">
              Orchestrator is actively routing tasks to domain specialist agents.
            </p>
          </div>
          <span className="orchestrator-working-badge">
            <span className="badge-dot" />
            {status === "failed" ? "Failed" : generating ? "Orchestrator Active" : "Ready"}
          </span>
        </div>
        <div className="pipeline-steps-container">
          {PIPELINE.map((step, idx) => {
            const state = done || (stepIndex > idx && lastStep)
              ? "completed"
              : stepIndex === idx && generating
                ? "running"
                : "waiting";
            return (
              <div key={step.title} className={`pipeline-step-item ${state}`}>
                <div className="step-indicator-circle">{idx + 1}</div>
                <div className="step-details-meta">
                  <span className="step-title-text">{step.title}</span>
                  <span className="step-detail-subtext">{step.sub}</span>
                </div>
              </div>
            );
          })}
        </div>
        {campaignId ? (
          <p style={{ marginTop: 16 }}>
            <Link href={`/campaigns/${campaignId}`} className="module-link">
              Open live run →
            </Link>
          </p>
        ) : null}
      </div>

      <div className={`generation-output-showcase${done ? " active" : ""}`}>
        <div className="showcase-header">
          <div className="showcase-title-wrap">
            <span className="showcase-badge">Content Ready</span>
            <h2 className="showcase-title">Platform Content Generated</h2>
          </div>
          <button type="button" className="btn btn-primary" onClick={approveAll} disabled={pending}>
            Approve All to Review Pipeline
          </button>
        </div>
        <div className="showcase-cards-grid">
          {drafts.map((draft) => (
            <article key={draft.id} className="result-platform-card">
              <div className="result-card-header">
                <PlatformPill platform={draft.platform} />
                <span className="badge badge-green">
                  {draft.score != null ? `${Math.round(draft.score * 10)}/10` : "Ready"}
                </span>
              </div>
              <div className="result-content-body">
                <div className="result-content-snippet">{draft.body.slice(0, 280)}</div>
              </div>
              <div className="result-card-actions">
                <button type="button" className="btn-result-action" onClick={() => setEditing(draft)}>
                  Preview
                </button>
                <button
                  type="button"
                  className="btn-result-approve"
                  onClick={() =>
                    void reviewDraftOrThrow(draft.campaign_id, draft.id, { action: "approve" }).then(
                      () => toast.success("Approved"),
                      (err) => toast.error(err instanceof Error ? err.message : "Failed"),
                    )
                  }
                >
                  Approve
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <Drawer open={strategyOpen} onClose={() => setStrategyOpen(false)} size="narrow">
        <DrawerHeader title="Content Strategy" sub="Positioning and distribution intent" onClose={() => setStrategyOpen(false)} />
        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          <ChipGroup label="Primary Purpose" values={["Awareness", "Thought Leadership", "Product Launch", "Lead Gen"]} active={goal} onSelect={setGoal} />
          <ChipGroup label="Target Persona" values={audiences} active={selectedAudience} onSelect={setSelectedAudience} />
          <ChipGroup
            label="Narrative Format"
            values={["Educational", "Contrarian Thesis", "Step-by-Step Playbook", "Case Study"]}
            active={format}
            onSelect={setFormat}
          />
          <button type="button" className="btn btn-primary" onClick={() => setStrategyOpen(false)}>
            Apply Strategy
          </button>
        </div>
      </Drawer>

      <Drawer open={advancedOpen} onClose={() => setAdvancedOpen(false)} size="narrow">
        <DrawerHeader title="Advanced Controls" sub="Research depth and generation constraints" onClose={() => setAdvancedOpen(false)} />
        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          <label className="drawer-setting-label">Research depth</label>
          <div className="segmented-control">
            {["quick", "standard", "deep"].map((val) => (
              <button
                key={val}
                type="button"
                className={`segmented-btn${research === val ? " active" : ""}`}
                onClick={() => setResearch(val)}
              >
                {val}
              </button>
            ))}
          </div>
          <label className="drawer-setting-label">Creativity · {creativity.toFixed(1)}</label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.1}
            value={creativity}
            onChange={(e) => setCreativity(Number(e.target.value))}
          />
          <label className="drawer-setting-label">Content length</label>
          <div className="segmented-control">
            {["short", "medium", "long"].map((val) => (
              <button
                key={val}
                type="button"
                className={`segmented-btn${length === val ? " active" : ""}`}
                onClick={() => setLength(val)}
              >
                {val}
              </button>
            ))}
          </div>
          <label className="toggle-setting-row">
            <span>Include research</span>
            <input type="checkbox" checked={includeResearch} onChange={(e) => setIncludeResearch(e.target.checked)} />
          </label>
          <label className="toggle-setting-row">
            <span>Use brand voice</span>
            <input type="checkbox" checked={brandVoice} onChange={(e) => setBrandVoice(e.target.checked)} />
          </label>
          <label className="drawer-setting-label">Image (optional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
          <button type="button" className="btn btn-primary" onClick={() => setAdvancedOpen(false)}>
            Save Preferences
          </button>
        </div>
      </Drawer>

      <EditorDrawer
        draft={editing}
        author={{
          name: brandName ?? "Brand",
          handle: (brandName ?? "brand").toLowerCase().replace(/\s+/g, ""),
          initial: (brandName ?? "B").slice(0, 1).toUpperCase(),
        }}
        canMutate
        onClose={() => setEditing(null)}
        onChanged={() => undefined}
      />
    </div>
  );
}

function Intel({ label, value }: { label: string; value: string }) {
  return (
    <div className="intelligence-item">
      <span className="intel-label">{label}</span>
      <span className="intel-value">{value}</span>
    </div>
  );
}

function ChipGroup({
  label,
  values,
  active,
  onSelect,
  onAdd,
}: {
  label: string;
  values: string[];
  active: string;
  onSelect: (value: string) => void;
  onAdd?: () => void;
}) {
  return (
    <div className="context-group">
      <div className="context-group-header">
        <span className="context-group-label">{label}</span>
      </div>
      <div className="chip-cluster">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className={`context-chip${active === value ? " active" : ""}`}
            onClick={() => onSelect(value)}
          >
            {value}
          </button>
        ))}
        {onAdd ? (
          <button type="button" className="context-chip add-chip" onClick={onAdd}>
            +
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DrawerHeader({
  title,
  sub,
  onClose,
}: {
  title: string;
  sub: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 24px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>{title}</h3>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sub}</span>
      </div>
      <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
