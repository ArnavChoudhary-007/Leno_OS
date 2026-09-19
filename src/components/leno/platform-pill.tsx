import { platformLabel } from "@/lib/workspace-ui";
import type { PlatformId } from "@/shared/types";

export function PlatformPill({ platform }: { platform: string }) {
  const cls =
    platform === "linkedin"
      ? "platform-linkedin"
      : platform === "instagram"
        ? "platform-instagram"
        : platform === "x"
          ? "platform-twitter"
          : "";
  return (
    <span className={`badge ${cls || "badge-neutral"}`} style={{ fontSize: "0.72rem" }}>
      {platformLabel(platform as PlatformId)}
    </span>
  );
}
