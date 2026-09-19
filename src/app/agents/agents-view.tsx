"use client";

import { useState, type ReactNode } from "react";
import { AgentDrawer, type AgentInfo } from "@/components/leno/agent-drawer";
import { Bot, Shield, Sparkles, Users } from "lucide-react";

export function AgentsView({ agents }: { agents: AgentInfo[] }) {
  const [open, setOpen] = useState<AgentInfo | null>(null);

  return (
    <div className="agents-container">
      <div className="agents-header">
        <div>
          <h2 className="agents-title">Specialist Agents</h2>
          <p className="agents-subtitle">
            Your dedicated distribution team, coordinated behind the scenes.
          </p>
        </div>
      </div>

      <div className="orchestration-flow-card">
        <strong style={{ fontSize: "1rem" }}>Agent Orchestration & Task Routing Architecture</strong>
        <div className="flow-diagram-wrapper">
          <FlowNode icon={<Users size={22} />} label="User Brief" sub="Intent & Goals" />
          <div className="flow-connector-line" />
          <FlowNode
            icon={<Sparkles size={22} />}
            label="Orchestrator"
            sub="Task Dispatch"
            accent
          />
          <div className="flow-connector-line" />
          <FlowNode icon={<Bot size={22} />} label="Specialist Agents" sub="LinkedIn • Instagram • X" />
          <div className="flow-connector-line" />
          <FlowNode icon={<Shield size={22} />} label="Critic Engine" sub="Quality Gate" />
          <div className="flow-connector-line" />
          <FlowNode icon={<Users size={22} />} label="Human Review" sub="Final Approval" />
        </div>
      </div>

      <div className="agents-cards-grid">
        {agents.map((agent) => (
          <button
            type="button"
            key={agent.id}
            className="agent-card"
            onClick={() => setOpen(agent)}
          >
            <div className="agent-card-header">
              <div className="agent-card-identity">
                <div className="agent-avatar-box">
                  <Bot size={22} />
                </div>
                <div className="agent-info-names">
                  <span className="agent-title-text">{agent.name}</span>
                  <span className="agent-persona-tag">{agent.role}</span>
                </div>
              </div>
              <span className={`badge badge-${agent.statusType}`}>
                <span className="badge-dot" />
                {agent.status}
              </span>
            </div>
            <div style={{ fontSize: "0.84rem", color: "var(--text-secondary)" }}>
              <strong>Current Task:</strong> {agent.currentTask}
            </div>
            <div className="agent-card-stats">
              <div className="agent-stat-item">
                <span className="agent-stat-num">{agent.tasksCompleted}</span>
                <span className="agent-stat-name">Tasks Completed</span>
              </div>
              <div className="agent-stat-item">
                <span className="agent-stat-num">{agent.uptime}</span>
                <span className="agent-stat-name">Health / Uptime</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 8,
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
              }}
            >
              <span>Last active: {agent.lastActive}</span>
              <span className="btn btn-sm btn-subtle">Inspect Agent →</span>
            </div>
          </button>
        ))}
        <div className="agent-card" style={{ borderStyle: "dashed", background: "transparent" }}>
          <div className="agent-card-header">
            <div className="agent-card-identity">
              <div
                className="agent-avatar-box"
                style={{
                  background: "var(--bg-surface-subtle)",
                  border: "1px dashed var(--border-medium)",
                  color: "var(--text-muted)",
                }}
              >
                +
              </div>
              <div className="agent-info-names">
                <span className="agent-title-text">Add Platform Agent</span>
                <span className="agent-persona-tag">YouTube, TikTok, Substack</span>
              </div>
            </div>
          </div>
          <p className="card-subtitle">Coming later — the playbook registry is how new channels land.</p>
        </div>
      </div>

      <AgentDrawer agent={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function FlowNode({
  icon,
  label,
  sub,
  accent,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="flow-node-box">
      <div
        className="flow-node-icon-circle"
        style={accent ? { borderColor: "var(--accent-primary)", color: "var(--accent-primary)" } : undefined}
      >
        {icon}
      </div>
      <span className="flow-node-label">{label}</span>
      <span className="flow-node-sub">{sub}</span>
    </div>
  );
}
