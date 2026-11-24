import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

const variants = {
  default: "l-badge-dashed",
  primary: "l-badge-outline",
  success: "l-badge-lime",
  warning: "l-badge-light",
  danger: "l-badge-danger",
  live: "l-badge-outline",
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
    <span className={cn("l-badge", variants[variant], live && "l-pulse", className)} {...props}>
      {children}
    </span>
  );
}
