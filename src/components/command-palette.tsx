"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bot,
  FileText,
  LayoutDashboard,
  Link2,
  Moon,
  Palette,
  PenLine,
  Radio,
} from "lucide-react";

type PaletteItem = {
  href?: string;
  label: string;
  category: string;
  icon: ReactNode;
  action?: () => void;
};

function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("leno-theme", theme);
}

export function CommandPalette({
  canMutate,
  reviewCount,
}: {
  canMutate: boolean;
  reviewCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const items = useMemo<PaletteItem[]>(() => {
    const nav: PaletteItem[] = [
      {
        href: "/",
        label: "Open Overview Dashboard",
        category: "NAVIGATION",
        icon: <LayoutDashboard size={15} />,
      },
      {
        href: "/campaigns",
        label: "Open Content Library",
        category: "NAVIGATION",
        icon: <FileText size={15} />,
      },
      {
        href: "/track",
        label: "Open Content Lifecycle Tracker",
        category: "NAVIGATION",
        icon: <Radio size={15} />,
      },
      {
        href: "/analytics",
        label: "View Performance Analytics",
        category: "NAVIGATION",
        icon: <BarChart3 size={15} />,
      },
      {
        href: "/agents",
        label: "Inspect Agent Orchestrator",
        category: "AGENTS",
        icon: <Bot size={15} />,
      },
      {
        href: "/integrations",
        label: "Manage Integrations",
        category: "SETTINGS",
        icon: <Link2 size={15} />,
      },
      {
        href: "/brand",
        label: "Edit brand card",
        category: "SETTINGS",
        icon: <Palette size={15} />,
      },
      {
        label: "Toggle Dark / Light Mode",
        category: "PREFERENCES",
        icon: <Moon size={15} />,
        action: () => {
          const next =
            document.documentElement.getAttribute("data-theme") === "dark"
              ? "light"
              : "dark";
          applyTheme(next);
        },
      },
    ];
    const actions: PaletteItem[] = [];
    if (canMutate) {
      actions.push({
        href: "/campaigns/new",
        label: "Create new post",
        category: "ACTIONS",
        icon: <PenLine size={15} />,
      });
    }
    if (reviewCount > 0) {
      actions.push({
        href: "/campaigns?status=Review",
        label: `Review pending content (${reviewCount} waiting)`,
        category: "ACTIONS",
        icon: <Radio size={15} />,
      });
    }
    return [...actions, ...nav];
  }, [canMutate, reviewCount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    setSelected(0);
  }, [query, open]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
      }
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((i) =>
          filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
        );
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = filtered[selected];
        if (item) run(item);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selected]);

  function run(item: PaletteItem) {
    setOpen(false);
    setQuery("");
    item.action?.();
    if (item.href) router.push(item.href);
  }

  const grouped = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    acc[item.category] = acc[item.category] ?? [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <>
      <button
        type="button"
        className="command-trigger-btn"
        title="Open Command Center"
        onClick={() => setOpen(true)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="kbd-badge">⌘K</span>
        <span>Search or command</span>
      </button>
      {open ? (
        <div
          className="modal-backdrop open"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          onClick={() => setOpen(false)}
        >
          <div className="cmd-palette-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="cmd-input-container">
              <svg className="cmd-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="cmd-input"
                autoFocus
                value={query}
                placeholder="Type a command, search posts, or jump to view..."
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className="kbd-badge">ESC</span>
            </div>
            <div className="cmd-results-list">
              {filtered.length === 0 ? (
                <p className="cmd-category-header">No matches</p>
              ) : (
                Object.entries(grouped).map(([category, group]) => (
                  <div key={category}>
                    <p className="cmd-category-header">{category}</p>
                    {group.map((item) => {
                      const index = filtered.indexOf(item);
                      return (
                        <button
                          key={item.label}
                          type="button"
                          className={`cmd-item${index === selected ? " selected" : ""}`}
                          onMouseEnter={() => setSelected(index)}
                          onClick={() => run(item)}
                        >
                          <span className="cmd-item-left">
                            {item.icon}
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
