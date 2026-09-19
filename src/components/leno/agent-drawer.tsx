"use client";

import { Drawer } from "@/components/leno/drawer";

export type AgentInfo = {
  id: string;
  name: string;
  role: string;
  status: string;
  statusType: "green" | "amber" | "blue" | "neutral";
  currentTask: string;
  tasksCompleted: number;
  uptime: string;
  lastActive: string;
  capabilities: string[];
};

export function AgentDrawer({
  agent,
  onClose,
}: {
  agent: AgentInfo | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={Boolean(agent)} onClose={onClose}>
      {agent ? (
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
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700 }}>{agent.name}</h3>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                {agent.role}
              </span>
            </div>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <div
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 20,
              overflowY: "auto",
            }}
          >
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
                Operational Status
              </span>
              <span className={`badge badge-${agent.statusType}`}>
                <span className="badge-dot" />
                {agent.status}
              </span>
            </div>
            <div>
              <span
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                  display: "block",
                }}
              >
                Specialist Tools & Capabilities
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {agent.capabilities.map((cap) => (
                  <div key={cap} className="card" style={{ padding: "10px 12px" }}>
                    {cap}
                  </div>
                ))}
              </div>
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
                Telemetry Summary
              </span>
              <div
                style={{
                  padding: 14,
                  background: "var(--bg-surface-subtle)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.82rem",
                  lineHeight: 1.45,
                }}
              >
                <p>
                  <strong>Current task:</strong> {agent.currentTask}
                </p>
                <p>
                  <strong>Tasks completed:</strong> {agent.tasksCompleted}
                </p>
                <p>
                  <strong>Health:</strong> {agent.uptime}
                </p>
                <p>
                  <strong>Last active:</strong> {agent.lastActive}
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
