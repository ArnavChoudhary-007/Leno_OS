"use client";

import { useState } from "react";

export type AgentCard = {
  id: string;
  label: string;
  status: string;
  on: boolean;
  busy: boolean;
  role: string;
  task: string;
  stats: { label: string; value: string }[];
  caps: string[];
  last: string;
};

export function AgentsView({
  agents,
  models,
  writers,
}: {
  agents: AgentCard[];
  models: { writer: string; critic: string };
  writers: string[];
}) {
  const [selectedId, setSelectedId] = useState(agents[0]?.id);
  const sel = agents.find((a) => a.id === selectedId) ?? agents[0];
  const model = sel.id === "critic" ? models.critic : sel.id === "image" || sel.id === "research" ? null : models.writer;

  return (
    <div className="l-page">
      <h1 className="l-h1">Agents</h1>

      <section aria-label="How a brief moves" className="l-card l-flow">
        <div className="l-flow-node">Your brief</div>
        <span aria-hidden="true" className="l-flow-arrow">→</span>
        <div className="l-flow-node is-light">Orchestrator</div>
        <span aria-hidden="true" className="l-flow-arrow">→</span>
        <div className="l-flow-stack">
          {writers.map((w) => (
            <span key={w} className="l-flow-chip">
              {w}
            </span>
          ))}
        </div>
        <span aria-hidden="true" className="l-flow-arrow">→</span>
        <div className="l-flow-node is-outline">
          <span style={{ fontWeight: 600 }}>Critic</span>
          <span className="l-muted" style={{ fontSize: 13 }}>
            Below 0.80 goes back, up to 3 rounds
          </span>
        </div>
        <span aria-hidden="true" className="l-flow-arrow">→</span>
        <div className="l-flow-node is-lime">You approve</div>
      </section>

      <div className="l-agents">
        <div className="l-agent-list">
          {agents.map((a) => (
            <button
              key={a.id}
              type="button"
              className="l-agent"
              aria-pressed={a.id === sel.id}
              onClick={() => setSelectedId(a.id)}
            >
              <span aria-hidden="true" className={`l-dot${a.on ? "" : " is-off"}${a.busy ? " l-pulse" : ""}`} />
              <span className="l-agent-text">
                <span className="l-agent-name">{a.label}</span>
                <span className="l-agent-task">{a.task}</span>
              </span>
              <span className="l-agent-last">{a.last}</span>
            </button>
          ))}
        </div>
        <aside aria-label="Agent details" className="l-card l-agent-detail" aria-live="polite">
          <div className="l-stack-8">
            <span style={{ fontSize: 14, color: sel.on ? "var(--l-lime)" : "var(--l-text-3)" }}>{sel.status}</span>
            <h2 className="l-display" style={{ fontSize: 44, lineHeight: 0.95 }}>
              {sel.label}
            </h2>
            <p className="l-lede" style={{ fontSize: 16 }}>
              {sel.role}
            </p>
          </div>
          <div className="l-agent-stats">
            {sel.stats.map((s) => (
              <div key={s.label} className="l-stack-4">
                <span className="l-faint" style={{ fontSize: 13 }}>
                  {s.label}
                </span>
                <span className="mono" style={{ fontSize: 22 }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
          <div className="l-stack-10">
            <span className="l-muted" style={{ fontSize: 14 }}>
              Working on
            </span>
            <span style={{ fontSize: 16 }}>{sel.task}</span>
          </div>
          {model ? (
            <div className="l-stack-10">
              <span className="l-muted" style={{ fontSize: 14 }}>
                Model
              </span>
              <span className="mono" style={{ fontSize: 14 }}>
                {model}
              </span>
            </div>
          ) : null}
          <div className="l-stack-10">
            <span className="l-muted" style={{ fontSize: 14 }}>
              What it handles
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {sel.caps.map((c) => (
                <span key={c} className="l-cap">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
