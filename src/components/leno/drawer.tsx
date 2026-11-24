"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Right-hand slide-over. Escape or a click outside closes it. */
export function Drawer({
  open,
  onClose,
  children,
  size = "default",
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "default" | "wide" | "narrow";
  label: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = size === "wide" ? " drawer-wide" : size === "narrow" ? " drawer-narrow" : "";

  return (
    <div className="drawer-backdrop">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        style={{ position: "absolute", inset: 0, border: 0, background: "transparent", cursor: "default" }}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`drawer-panel${sizeClass}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{ outline: "none" }}
      >
        {children}
      </div>
    </div>
  );
}
