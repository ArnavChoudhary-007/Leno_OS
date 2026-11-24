"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaletteEntry } from "@/components/app-chrome";

type Command = PaletteEntry;

/**
 * Search or jump to: pages, actions, and the workspace's latest posts.
 * ⌘K / Ctrl+K toggles it from anywhere.
 */
export function CommandPalette({
  canMutate,
  reviewCount,
  posts,
}: {
  canMutate: boolean;
  reviewCount: number;
  posts: PaletteEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [];
    if (canMutate) list.push({ label: "Write a new post", href: "/campaigns/new", kind: "Create" });
    if (reviewCount > 0) {
      list.push({
        label: `Review ${reviewCount} post${reviewCount === 1 ? "" : "s"} waiting for approval`,
        href: "/campaigns?status=Waiting",
        kind: "Action",
      });
    }
    list.push(
      { label: "Go to Overview", href: "/", kind: "Page" },
      { label: "Go to Content", href: "/campaigns", kind: "Page" },
      { label: "Go to Track", href: "/track", kind: "Page" },
      { label: "Go to Analytics", href: "/analytics", kind: "Page" },
      { label: "Go to Agents", href: "/agents", kind: "Page" },
      { label: "Connect a platform", href: "/integrations", kind: "Integrations" },
      { label: "Edit the brand card", href: "/brand", kind: "Settings" },
      { label: "How Leno works", href: "/help", kind: "Help" },
    );
    return [...list, ...posts];
  }, [canMutate, reviewCount, posts]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 8);
    const words = q.split(/\s+/);
    return commands.filter((c) => {
      const hay = `${c.label} ${c.kind}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [commands, query]);

  const active = Math.min(cursor, Math.max(results.length - 1, 0));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setCursor(0);
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function go(cmd: Command | undefined) {
    if (!cmd) return;
    setOpen(false);
    router.push(cmd.href);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(active + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(active - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        className="l-search-btn"
        onClick={() => {
          setQuery("");
          setCursor(0);
          setOpen(true);
        }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <span className="l-search-label">Search or jump to</span>
        <kbd className="l-kbd">⌘K</kbd>
      </button>
      {open ? (
        <div className="l-palette-backdrop">
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setOpen(false)}
            style={{ position: "absolute", inset: 0, border: 0, background: "transparent", cursor: "default" }}
          />
          <div role="dialog" aria-modal="true" aria-label="Search and commands" className="l-palette">
            <label htmlFor="leno-cmd" className="sr-only-l">
              Search commands and posts
            </label>
            <div className="l-palette-input-row">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" />
              </svg>
              <input
                id="leno-cmd"
                className="l-palette-input"
                autoFocus
                autoComplete="off"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Type a command or a post title"
                role="combobox"
                aria-expanded="true"
                aria-controls="leno-cmd-list"
                aria-activedescendant={results.length ? `leno-cmd-${active}` : undefined}
              />
              <kbd className="l-kbd">esc</kbd>
            </div>
            <div className="l-palette-list" id="leno-cmd-list" role="listbox" ref={listRef}>
              {results.map((r, i) => (
                <button
                  key={`${i}-${r.href}`}
                  id={`leno-cmd-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  className={`l-palette-item${i === active ? " is-active" : ""}`}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(r)}
                >
                  <span className="l-palette-item-label">{r.label}</span>
                  <span className="l-palette-kind">{r.kind}</span>
                </button>
              ))}
              {results.length === 0 ? (
                <p style={{ margin: 0, padding: "24px 12px", color: "var(--l-text-3)", fontSize: 15 }}>
                  Nothing matches that
                </p>
              ) : null}
            </div>
            <div className="l-palette-foot">
              <span>↑ ↓ to move</span>
              <span>Enter to open</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
