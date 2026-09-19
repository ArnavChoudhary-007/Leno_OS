"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { signOut } from "@/auth/actions";
import { BrandMark } from "@/components/brand-mark";
import { CommandPalette } from "@/components/command-palette";
import {
  NotificationBell,
  type ChromeNotification,
} from "@/components/notifications";
import { ThemeToggle } from "@/components/theme-toggle";
import { roleLabel } from "@/lib/workspace-ui";
import {
  BarChart3,
  Bot,
  CircleHelp,
  FileText,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Palette,
  PenLine,
  Radio,
} from "lucide-react";
import type { WorkspaceRole } from "@/shared/types";

export type ShellNav =
  | "overview"
  | "create"
  | "content"
  | "track"
  | "analytics"
  | "agents"
  | "integrations"
  | "brand"
  | "help";

const VIEW_META: Record<ShellNav, { title: string; desc: string }> = {
  overview: { title: "Overview", desc: "System health and distribution performance" },
  create: { title: "Create Content", desc: "AI-assisted generation and multi-platform adaptation" },
  content: { title: "Content Library", desc: "Manage, filter, and schedule platform assets" },
  track: { title: "Content Tracking", desc: "Monitor lifecycle from generation to publication" },
  analytics: { title: "Performance Analytics", desc: "Distribution metrics and audience engagement" },
  agents: { title: "Specialist Agents", desc: "Autonomous agent team and orchestration flow" },
  integrations: { title: "Connected Integrations", desc: "Platform API authorizations and sync channels" },
  brand: { title: "Settings", desc: "Brand card every agent reads before writing" },
  help: { title: "Help & Docs", desc: "How Leno OS plans, drafts, and publishes" },
};

export function AppChrome({
  children,
  email,
  role,
  canMutate,
  current,
  reviewCount,
  agentCount,
  notifications,
}: {
  children: ReactNode;
  email: string | null;
  role: WorkspaceRole;
  canMutate: boolean;
  current: ShellNav;
  reviewCount: number;
  agentCount: number;
  notifications: ChromeNotification[];
}) {
  const [navOpen, setNavOpen] = useState(false);
  const initial = (email ?? role).slice(0, 1).toUpperCase();
  const name = email?.split("@")[0] ?? role;
  const meta = VIEW_META[current];

  return (
    <div className="app-layout">
      <div
        className={`mobile-nav-backdrop${navOpen ? " open" : ""}`}
        onClick={() => setNavOpen(false)}
      />
      <aside className={`app-sidebar${navOpen ? " open" : ""}`}>
        <Link href="/" className="sidebar-brand" onClick={() => setNavOpen(false)}>
          <BrandMark />
          <span className="brand-text-block">
            <span className="brand-title">leno os</span>
            <span className="brand-subtitle">Your AI Distribution OS</span>
          </span>
        </Link>

        <nav className="sidebar-nav-group" aria-label="Primary">
          <NavItem href="/" active={current === "overview"} icon={<LayoutDashboard className="nav-item-icon" />} onClick={() => setNavOpen(false)}>
            Overview
          </NavItem>
          {canMutate ? (
            <NavItem href="/campaigns/new" active={current === "create"} icon={<PenLine className="nav-item-icon" />} onClick={() => setNavOpen(false)}>
              Create
            </NavItem>
          ) : null}
          <NavItem
            href="/campaigns"
            active={current === "content"}
            icon={<FileText className="nav-item-icon" />}
            badge={reviewCount > 0 ? String(reviewCount) : undefined}
            onClick={() => setNavOpen(false)}
          >
            Content
          </NavItem>
          <NavItem href="/track" active={current === "track"} icon={<Radio className="nav-item-icon" />} onClick={() => setNavOpen(false)}>
            Track
          </NavItem>
          <NavItem href="/analytics" active={current === "analytics"} icon={<BarChart3 className="nav-item-icon" />} onClick={() => setNavOpen(false)}>
            Analytics
          </NavItem>
          <NavItem
            href="/agents"
            active={current === "agents"}
            icon={<Bot className="nav-item-icon" />}
            badge={agentCount > 0 ? String(agentCount) : undefined}
            badgeGreen
            onClick={() => setNavOpen(false)}
          >
            Agents
          </NavItem>
          <NavItem href="/integrations" active={current === "integrations"} icon={<Link2 className="nav-item-icon" />} onClick={() => setNavOpen(false)}>
            Integrations
          </NavItem>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-nav-group">
            <NavItem href="/brand" active={current === "brand"} icon={<Palette className="nav-item-icon" />} onClick={() => setNavOpen(false)}>
              Settings
            </NavItem>
            <NavItem href="/help" active={current === "help"} icon={<CircleHelp className="nav-item-icon" />} onClick={() => setNavOpen(false)}>
              Help & Docs
            </NavItem>
          </div>
          <div className="sidebar-impact-card">
            <p className="impact-card-text">
              Turn ideas
              <br />
              into impact.
            </p>
            <p className="impact-card-sub">—</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="sidebar-nav-item" style={{ width: "100%" }}>
              <span className="nav-item-content">
                <LogOut className="nav-item-icon" />
                Sign out
              </span>
            </button>
          </form>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-open-btn btn-icon"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <Menu size={18} />
            </button>
            <ThemeToggle />
            <div>
              <span id="topbarPageTitle" style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                {meta.title}
              </span>
              <span id="topbarPageDesc" style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: 8 }}>
                {meta.desc}
              </span>
            </div>
          </div>

          <div className="topbar-center">
            <CommandPalette canMutate={canMutate} reviewCount={reviewCount} />
            <div className="topbar-quick-actions">
              {canMutate ? (
                <Link href="/campaigns/new" className="topbar-pill-action pill-primary">
                  + Create
                </Link>
              ) : null}
              <Link href="/track" className="topbar-pill-action">
                Track
              </Link>
              <Link href="/analytics" className="topbar-pill-action">
                Analytics
              </Link>
              <Link href="/agents" className="topbar-pill-action">
                Agents
              </Link>
            </div>
          </div>

          <div className="topbar-right">
            <NotificationBell items={notifications} />
            <div className="topbar-profile-btn" title={email ?? role}>
              <span className="user-avatar">{initial}</span>
              <span className="user-meta-block hidden sm:flex">
                <span className="user-name max-w-40 truncate">{name}</span>
                <span className="user-role">{roleLabel(role)}</span>
              </span>
            </div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

function NavItem({
  href,
  active,
  icon,
  badge,
  badgeGreen,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  badge?: string;
  badgeGreen?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`sidebar-nav-item${active ? " active" : ""}`}
      onClick={onClick}
    >
      <span className="nav-item-content">
        {icon}
        {children}
      </span>
      {badge ? (
        badgeGreen ? (
          <span className="badge badge-green" style={{ fontSize: "0.68rem", padding: "1px 5px" }}>
            {badge}
          </span>
        ) : (
          <span className="nav-badge-pill">{badge}</span>
        )
      ) : null}
    </Link>
  );
}
