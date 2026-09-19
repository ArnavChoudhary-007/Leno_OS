import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { WorkflowHero } from "@/components/workflow-hero";

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
    <main className="mx-auto grid min-h-screen w-full max-w-5xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_320px]">
      <div className="mx-auto w-full max-w-sm lg:mx-0">
        <div className="mb-8 flex items-center gap-2.5">
          <BrandMark />
          <span className="text-sm font-semibold tracking-tight">
            Distribution OS
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="surface mt-8 rounded-2xl border border-border p-6">
          {children}
        </div>
      </div>
      <div className="hidden lg:block">
        <WorkflowHero />
      </div>
    </main>
  );
}
