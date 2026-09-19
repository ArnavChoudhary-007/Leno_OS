import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/** Lightweight pulse placeholder — no extra dependency. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
