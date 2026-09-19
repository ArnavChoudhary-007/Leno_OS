"use client";

import { useEffect, type ReactNode } from "react";

export function Drawer({
  open,
  onClose,
  children,
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "default" | "wide" | "narrow";
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass =
    size === "wide" ? " drawer-wide" : size === "narrow" ? " drawer-narrow" : "";

  return (
    <div className="drawer-backdrop open" onClick={onClose} role="presentation">
      <div
        className={`drawer-panel${sizeClass}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
