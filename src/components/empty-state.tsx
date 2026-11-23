import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("l-empty", className)}>
      <p className="l-empty-title">{title}</p>
      <p className="l-empty-text">{description}</p>
      {action ? <div className="flex flex-wrap gap-3">{action}</div> : null}
    </div>
  );
}
