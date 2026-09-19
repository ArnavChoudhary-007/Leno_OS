import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-7" : "size-[28px]";
  return (
    <span
      className={cn("brand-logo-mark", box, className)}
      aria-hidden="true"
    />
  );
}
