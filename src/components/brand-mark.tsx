import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-7 text-[11px]" : "size-8 text-xs";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm",
        box,
        className,
      )}
      aria-hidden="true"
    >
      L
    </span>
  );
}
