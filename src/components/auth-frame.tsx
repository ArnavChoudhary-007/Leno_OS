import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand-mark";

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
        <BrandLockup />
        <h1 className="l-auth-title">{title}</h1>
        <p className="l-auth-sub">{description}</p>
        <div className="l-card" style={{ marginTop: 8 }}>
          {children}
        </div>
      </div>
    </main>
  );
}
