"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/auth/actions";
import { BrandLockup } from "@/components/brand-mark";
import { CommandPalette } from "@/components/command-palette";
import {
  NotificationBell,
  type ChromeNotification,
} from "@/components/notifications";
import { greetingName, roleLabel } from "@/lib/workspace-ui";
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

export type PaletteEntry = {
  label: string;
  kind: string;
  href: string;
};

const VIEW_META: Record<ShellNav, { title: string; sub: string }> = {
  create: { title: "Create", sub: "One idea, a post for every feed" },
  overview: { title: "Overview", sub: "How your distribution is doing" },
  content: { title: "Content", sub: "Every post Leno has written for you" },
  track: { title: "Track", sub: "Where every post is, from idea to live" },
  analytics: { title: "Analytics", sub: "What Leno has written and shipped" },
  agents: { title: "Agents", sub: "Who writes, who checks, and what they're doing now" },
  integrations: { title: "Integrations", sub: "Where Leno can publish, and where you post by hand" },
  brand: { title: "Settings", sub: "The brand card every agent reads first" },
  help: { title: "Help and docs", sub: "How Leno plans, writes and publishes" },
};

const COLLAPSE_KEY = "leno_nav_collapsed";

export function AppChrome({
  children,
  email,
  role,
  canMutate,
  current,
  workspaceName,
  reviewCount,
  runningCount,
  notifications,
  posts,
  canSignOut,
}: {
  children: ReactNode;
  email: string | null;
  role: WorkspaceRole;
  canMutate: boolean;
  current: ShellNav;
  workspaceName: string;
  reviewCount: number;
  runningCount: number;
  notifications: ChromeNotification[];
  posts: PaletteEntry[];
  canSignOut: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const meta = VIEW_META[current];
  const name = email ? greetingName(email) : "Guest editor";
  const initial = name.slice(0, 1).toUpperCase();

  // Restore the rail preference after hydration (localStorage is client-only).
  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      stored = false;
    }
    if (stored) {
      const id = window.requestAnimationFrame(() => setCollapsed(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, []);

  function setRail(next: boolean) {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      // Private mode: keep it for this page only.
    }
    setCollapsed(next);
  }

  const items: { id: ShellNav; label: string; href: string; count?: number; review?: boolean }[] = [
    ...(canMutate ? [{ id: "create" as const, label: "Create", href: "/campaigns/new" }] : []),
    { id: "overview", label: "Overview", href: "/" },
    { id: "content", label: "Content", href: "/campaigns", count: reviewCount || undefined, review: true },
    { id: "track", label: "Track", href: "/track" },
    { id: "analytics", label: "Analytics", href: "/analytics" },
    { id: "agents", label: "Agents", href: "/agents", count: runningCount || undefined },
    { id: "integrations", label: "Integrations", href: "/integrations" },
  ];
  const active = items.find((it) => it.id === current) ?? items[0];
  const close = () => setMobileOpen(false);
  const showRail = collapsed && !mobileOpen;

  return (
    <div className="l-app">
      <button
        type="button"
        aria-label="Close navigation"
        className={`l-mobile-backdrop${mobileOpen ? " is-open" : ""}`}
        onClick={close}
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside
        aria-label="App"
        className={`l-sidebar${showRail ? " is-collapsed" : ""}${mobileOpen ? " is-open" : ""}`}
      >
        {showRail ? (
          <>
            <button
              type="button"
              className="l-rail-btn"
              aria-label="Open navigation"
              aria-expanded="false"
              onClick={() => setRail(false)}
            >
              <MenuIcon />
            </button>
            <Link href={active.href} aria-label={`Current page: ${meta.title}`} className="l-rail-dot" />
          </>
        ) : (
          <>
            <div className="l-sidebar-top">
              <BrandLockup onClick={close} />
              <button
                type="button"
                className="l-collapse-btn"
                aria-label="Hide navigation"
                aria-expanded="true"
                onClick={() => setRail(true)}
              >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </button>
              <button
                type="button"
                className="l-icon-btn l-menu-btn"
                aria-label="Close navigation"
                onClick={close}
              >
                <CloseIcon />
              </button>
            </div>

            <Link href="/brand" className="l-workspace" onClick={close}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span className="l-workspace-name">{workspaceName}</span>
                <span className="l-workspace-sub">Workspace</span>
              </span>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#A3A3A0" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 6l3-3 3 3M5 10l3 3 3-3" />
              </svg>
            </Link>

            <nav aria-label="Sections" className="l-nav">
              {items.map((it) => (
                <Link
                  key={it.id}
                  href={it.href}
                  className="l-nav-item"
                  aria-current={it.id === current ? "page" : undefined}
                  onClick={close}
                >
                  <span aria-hidden="true" className="l-nav-dot" />
                  <span className="l-nav-label">{it.label}</span>
                  {it.count ? (
                    <span
                      className={`l-nav-count${it.review ? " is-review" : ""}`}
                      aria-label={it.review ? `${it.count} waiting for approval` : `${it.count} running`}
                    >
                      {it.count}
                    </span>
                  ) : null}
                </Link>
              ))}
            </nav>

            <div className="l-sidebar-foot">
              <Link
                href="/brand"
                className="l-nav-item"
                aria-current={current === "brand" ? "page" : undefined}
                onClick={close}
              >
                <span aria-hidden="true" className="l-nav-dot" />
                <span className="l-nav-label">Settings</span>
              </Link>
              <Link
                href="/help"
                className="l-nav-item"
                aria-current={current === "help" ? "page" : undefined}
                onClick={close}
              >
                <span aria-hidden="true" className="l-nav-dot" />
                <span className="l-nav-label">Help and docs</span>
              </Link>
              {canSignOut ? (
                <form action={signOut}>
                  <button type="submit" className="l-nav-item">
                    <span aria-hidden="true" className="l-nav-dot" />
                    <span className="l-nav-label">Sign out</span>
                  </button>
                </form>
              ) : null}
              <div className="l-user" title={email ?? undefined}>
                <span aria-hidden="true" className="l-avatar">
                  {initial}
                </span>
                <span className="l-user-meta">
                  <span className="l-user-name">{name}</span>
                  <span className="l-user-role">{roleLabel(role)}</span>
                </span>
              </div>
            </div>
          </>
        )}
      </aside>

      <main className="l-main">
        <header className="l-topbar">
          <button
            type="button"
            className="l-icon-btn l-menu-btn"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon />
          </button>
          <div className="l-topbar-title">
            <span className="l-topbar-heading">{meta.title}</span>
            <span className="l-topbar-sub">{meta.sub}</span>
          </div>
          <CommandPalette canMutate={canMutate} reviewCount={reviewCount} posts={posts} />
          <NotificationBell items={notifications} />
        </header>
        {children}
      </main>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 5h12M3 9h12M3 13h12" />
    </svg>
  );
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}

export function ArrowIcon({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square">
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}
