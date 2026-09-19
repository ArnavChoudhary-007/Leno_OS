import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

const variants = {
  default: "badge-neutral",
  primary: "badge-blue",
  success: "badge-green",
  warning: "badge-amber",
  danger: "badge-red",
  live: "badge-purple",
} as const;

export function Badge({
  className,
  variant = "default",
  live = false,
  children,
  ...props
}: ComponentProps<"span"> & {
  variant?: keyof typeof variants;
  live?: boolean;
}) {
  return (
    <span className={cn("badge", variants[variant], className)} {...props}>
      <span className={cn("badge-dot", live && "animate-pulse")} />
      {children}
    </span>
  );
}
