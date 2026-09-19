import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div
          className="sidebar-brand"
          style={{ border: "none", margin: 0, padding: "0 0 24px" }}
        >
          <BrandMark />
          <span className="brand-text-block">
            <span className="brand-title">Leno OS</span>
            <span className="brand-subtitle">Distribution</span>
          </span>
        </div>
        <h1 className="create-cockpit-title">{title}</h1>
        <p className="create-cockpit-subtitle">{description}</p>
        <div className="card" style={{ marginTop: 24 }}>
          {children}
        </div>
      </div>
    </main>
  );
}
