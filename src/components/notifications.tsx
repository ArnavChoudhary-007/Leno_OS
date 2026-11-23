"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { relativeTime } from "@/lib/workspace-ui";

export type ChromeNotification = {
  id: string;
  title: string;
  /** ISO time it happened, or null for "right now". */
  at: string | null;
  href: string;
  unread: boolean;
};

const READ_KEY = "leno_notif_read";

function readIds(): string[] {
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function NotificationBell({ items }: { items: ChromeNotification[] }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);

  // "Mark all read" survives navigation: ids are remembered per browser.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setSeen(readIds()));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-notif-root]")) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rows = useMemo(
    () => items.map((n) => ({ ...n, isUnread: n.unread && !seen.includes(n.id) })),
    [items, seen],
  );
  const unreadCount = rows.filter((r) => r.isUnread).length;

  function markRead() {
    const next = [...new Set([...seen, ...items.map((n) => n.id)])].slice(-50);
    try {
      window.localStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setSeen(next);
  }

  return (
    <div className="l-notif" data-notif-root>
      <button
        type="button"
        className="l-notif-btn"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 13V8a4.5 4.5 0 019 0v5l1.5 1.5h-12L4.5 13zM7.5 16h3" />
        </svg>
        {unreadCount ? <span aria-hidden="true" className="l-notif-unread" /> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Notifications" className="l-notif-panel">
          <div className="l-notif-head">
            <span>Notifications</span>
            {unreadCount ? (
              <button type="button" className="l-notif-mark" onClick={markRead}>
                Mark all read
              </button>
            ) : null}
          </div>
          {rows.length === 0 ? (
            <p className="l-notif-empty">You’re all caught up</p>
          ) : (
            rows.map((n) => (
              <Link
                key={n.id}
                href={n.href}
                className={`l-notif-item${n.isUnread ? " is-unread" : ""}`}
                onClick={() => setOpen(false)}
              >
                <span aria-hidden="true" className="l-notif-dot" />
                <span className="l-notif-body">
                  <span className="l-notif-title">{n.title}</span>
                  <span className="l-notif-time">{n.at ? relativeTime(n.at) : "Now"}</span>
                </span>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
