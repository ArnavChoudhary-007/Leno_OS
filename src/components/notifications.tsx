"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export type ChromeNotification = {
  id: string;
  title: string;
  detail: string;
  tone: "amber" | "blue" | "green" | "neutral";
  href?: string;
};

export function NotificationBell({ items }: { items: ChromeNotification[] }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(false);
  const unread = items.length > 0 && !read;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-notif-root]")) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div style={{ position: "relative" }} data-notif-root>
      <button
        type="button"
        className="notification-bell-btn"
        title="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setRead(true);
        }}
      >
        <Bell size={16} />
        {unread ? <span className="notification-unread-dot" /> : null}
      </button>
      <div className={`card notification-dropdown${open ? " open" : ""}`}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <strong style={{ fontSize: "0.9rem" }}>Notifications</strong>
          {items.length > 0 ? (
            <span className="badge badge-amber" style={{ fontSize: "0.7rem" }}>
              {items.length} New
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.length === 0 ? (
            <p className="card-subtitle">You are caught up.</p>
          ) : (
            items.map((item) => {
              const inner = (
                <div
                  key={item.id}
                  className={`notification-item${item.tone === "amber" ? " tone-amber" : ""}`}
                >
                  <strong>{item.title}</strong>
                  <br />
                  <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                    {item.detail}
                  </span>
                </div>
              );
              return item.href ? (
                <Link key={item.id} href={item.href} onClick={() => setOpen(false)}>
                  {inner}
                </Link>
              ) : (
                inner
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
