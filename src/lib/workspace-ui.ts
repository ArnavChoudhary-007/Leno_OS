import type { DraftStatus, PlatformId, WorkspaceRole } from "@/shared/types";

export const PLATFORM_LABEL: Record<PlatformId, string> = {
  x: "Twitter / X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
};

export const PLATFORM_SHORT: Record<PlatformId, string> = {
  x: "X",
  linkedin: "LI",
  instagram: "IG",
  threads: "TH",
  facebook: "FB",
};

export type TrackStage =
  | "Generated"
  | "Validated"
  | "Review"
  | "Approved"
  | "Scheduled"
  | "Published";

export const TRACK_STAGES: TrackStage[] = [
  "Generated",
  "Validated",
  "Review",
  "Approved",
  "Scheduled",
  "Published",
];

export function isPlatformId(value: string): value is PlatformId {
  return value in PLATFORM_LABEL;
}

export function platformLabel(platform: string): string {
  return isPlatformId(platform) ? PLATFORM_LABEL[platform] : platform;
}

export function draftStage(draft: {
  status: DraftStatus;
  scheduled_at: string | null;
  score: number | null;
}): TrackStage {
  if (draft.status === "published") return "Published";
  if (draft.scheduled_at) return "Scheduled";
  if (draft.status === "approved") return "Approved";
  if (draft.status === "needs_human" || draft.status === "rejected") {
    return "Review";
  }
  if (draft.score != null) return "Validated";
  return "Generated";
}

export function stageBadgeClass(stage: TrackStage): string {
  switch (stage) {
    case "Published":
    case "Approved":
      return "badge-green";
    case "Scheduled":
      return "badge-blue";
    case "Review":
      return "badge-amber";
    case "Validated":
      return "badge-purple";
    default:
      return "badge-neutral";
  }
}

export function greetingName(email: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Workspace owner";
    case "admin":
      return "Admin";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
  }
}

export type ChartPoint = {
  date: string;
  val: number;
  highlight?: boolean;
  label?: string;
};

export function bucketByDay(
  timestamps: string[],
  days: number,
): ChartPoint[] {
  const now = new Date();
  const counts = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    counts.set(dayKey(d), 0);
  }
  for (const stamp of timestamps) {
    const d = new Date(stamp);
    if (Number.isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const key = dayKey(d);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const entries = [...counts.entries()];
  let maxIdx = 0;
  let maxVal = -1;
  const points: ChartPoint[] = entries.map(([key, val], idx) => {
    if (val >= maxVal) {
      maxVal = val;
      maxIdx = idx;
    }
    const d = new Date(key);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      val,
    };
  });
  if (points[maxIdx] && maxVal > 0) {
    points[maxIdx] = {
      ...points[maxIdx],
      highlight: true,
      label: String(maxVal),
    };
  }
  return points;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sparklineFromCounts(values: number[]): number[] {
  if (values.length === 0) return [0, 0, 0, 0, 0, 0, 0];
  return values.slice(-7);
}
