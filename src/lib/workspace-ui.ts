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
  | "Publishing"
  | "Publication failed"
  | "Published";

export const TRACK_STAGES: TrackStage[] = [
  "Generated",
  "Validated",
  "Review",
  "Approved",
  "Scheduled",
  "Publishing",
  "Publication failed",
  "Published",
];

export function isPlatformId(value: string): value is PlatformId {
  return Object.hasOwn(PLATFORM_LABEL, value);
}

export function nativePublishDestination(platform: string): string | null {
  if (platform === "linkedin") return "LinkedIn";
  if (platform === "x") return "Bluesky";
  return null;
}

export function canEditDraft(status: string): boolean {
  return status === "draft" || status === "needs_human" || status === "approved" || status === "rejected";
}

export function canApproveDraft(status: string): boolean {
  return status === "draft" || status === "needs_human" || status === "rejected";
}

export function inDateWindow(timestamp: string | null, days: number, now = new Date()): boolean {
  if (!timestamp || days < 1) return false;
  const time = new Date(timestamp).getTime();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return Number.isFinite(time) && time >= start.getTime() && time <= now.getTime();
}

export function draftWindow<Row extends { created_at: string; published_at: string | null; status: string }>(
  rows: Row[], days: number, now = new Date(),
): { created: Row[]; published: Row[]; publishedFromCreated: number } {
  const created = rows.filter((row) => inDateWindow(row.created_at, days, now));
  const published = rows.filter((row) => row.status === "published" && inDateWindow(row.published_at, days, now));
  return {
    created,
    published,
    publishedFromCreated: created.filter((row) => row.status === "published" && inDateWindow(row.published_at, days, now)).length,
  };
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
  if (draft.status === "publishing") return "Publishing";
  if (draft.status === "publish_failed") return "Publication failed";
  if (draft.status === "approved" && draft.scheduled_at) return "Scheduled";
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
    case "Publishing":
      return "badge-blue";
    case "Publication failed":
      return "badge-red";
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
  now = new Date(),
): ChartPoint[] {
  const counts = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    counts.set(dayKey(d), 0);
  }
  for (const stamp of timestamps) {
    const d = new Date(stamp);
    if (Number.isNaN(d.getTime()) || d > now) continue;
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
    const d = new Date(`${key}T00:00:00`);
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
