import type { DraftStatus, PlatformId, WorkspaceRole } from "@/shared/types";

export const PLATFORM_LABEL: Record<PlatformId, string> = {
  x: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  threads: "Threads",
  facebook: "Facebook",
};

/** Platforms the Create page offers, in display order. */
export const CREATE_PLATFORMS: PlatformId[] = ["linkedin", "x", "instagram", "threads"];

export function isPlatformId(value: string): value is PlatformId {
  return Object.hasOwn(PLATFORM_LABEL, value);
}

/** Where approved posts of this platform go live, or null when export-only. */
export function nativePublishDestination(platform: string): "LinkedIn" | "Bluesky" | null {
  if (platform === "linkedin") return "LinkedIn";
  if (platform === "x") return "Bluesky";
  return null;
}

/** Copy can change while a person still owns the decision. */
export function canEditDraft(status: string): boolean {
  return status === "draft" || status === "needs_human" || status === "approved" || status === "rejected";
}

export function canApproveDraft(status: string): boolean {
  return status === "draft" || status === "needs_human" || status === "rejected";
}

export function platformLabel(platform: string): string {
  return isPlatformId(platform) ? PLATFORM_LABEL[platform] : platform;
}

// ---------------------------------------------------------------------------
// Where a post is in its life. Derived from the draft row only, so every
// page (Overview, Content, Track, the sidebar count) agrees.
// ---------------------------------------------------------------------------

export type PostStage =
  | "Drafted" // critic passed, waiting for a person
  | "Flagged" // critic could not pass it in 3 rounds, waiting for a person
  | "Changes requested" // a person rejected it with a note
  | "Approved"
  | "Scheduled"
  | "Publishing" // a publish attempt is in flight
  | "Publication failed" // outcome uncertain, an admin must reconcile
  | "Published";

export const POST_STAGES: PostStage[] = [
  "Drafted",
  "Flagged",
  "Changes requested",
  "Approved",
  "Scheduled",
  "Publishing",
  "Publication failed",
  "Published",
];

type StageInput = {
  status: DraftStatus;
  scheduled_at: string | null;
};

export function postStage(draft: StageInput): PostStage {
  switch (draft.status) {
    case "published":
      return "Published";
    case "publishing":
      return "Publishing";
    case "publish_failed":
      return "Publication failed";
    case "approved":
      return draft.scheduled_at ? "Scheduled" : "Approved";
    case "needs_human":
      return "Flagged";
    case "rejected":
      return "Changes requested";
    default:
      return "Drafted";
  }
}

export type TrackStage = "Generated" | "Validated" | "Review" | "Approved" | "Scheduled" | "Publishing" | "Publication failed" | "Published";

/** Coarser stage names kept for the review rules main's tests pin down. */
export function draftStage(draft: StageInput & { score: number | null }): TrackStage {
  if (draft.status === "published") return "Published";
  if (draft.status === "publishing") return "Publishing";
  if (draft.status === "publish_failed") return "Publication failed";
  if (draft.status === "approved" && draft.scheduled_at) return "Scheduled";
  if (draft.status === "approved") return "Approved";
  if (draft.status === "needs_human" || draft.status === "rejected") return "Review";
  return draft.score != null ? "Validated" : "Generated";
}

/** Drafted or flagged: a person has to say yes before it can go anywhere. */
export function isWaiting(draft: StageInput): boolean {
  return draft.status === "draft" || draft.status === "needs_human";
}

/** The short status word tables show. */
export function statusWord(draft: StageInput): string {
  if (isWaiting(draft)) return "Waiting";
  return postStage(draft);
}

/** Badge class for a status word, following the design's four looks. */
export function statusBadgeClass(draft: StageInput): string {
  const stage = postStage(draft);
  if (stage === "Published") return "l-badge l-badge-lime";
  if (stage === "Publication failed") return "l-badge l-badge-danger";
  if (isWaiting(draft)) return "l-badge l-badge-light";
  if (stage === "Scheduled" || stage === "Approved" || stage === "Publishing") return "l-badge l-badge-outline";
  return "l-badge l-badge-dashed";
}

/** A one-line title for a post: the campaign goal, else its first line. */
export function postTitle(post: {
  campaign_goal?: string | null;
  body: string;
}): string {
  const goal = post.campaign_goal?.trim();
  if (goal) return goal;
  const first = post.body.trim().split("\n")[0] ?? "";
  return first.length > 90 ? `${first.slice(0, 88)}…` : first;
}

/** The post's opening line, used as the hook under a title. */
export function postHook(body: string): string {
  return body.trim().split("\n").find((line) => line.trim())?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

export function relativeTime(iso: string | Date, now = new Date()): string {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const diff = now.getTime() - then.getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  const hr = Math.round(abs / 3600000);
  const day = Math.round(abs / 86400000);
  let text: string;
  if (min < 1) return future ? "in a moment" : "just now";
  if (min < 60) text = `${min} min`;
  else if (hr < 24) text = `${hr} hour${hr === 1 ? "" : "s"}`;
  else if (day === 1) return future ? "Tomorrow" : "Yesterday";
  else if (day < 7) text = `${day} days`;
  else return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return future ? `in ${text}` : `${text} ago`;
}

export function shortDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function greetingName(email: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "there";
  const word = local.split(/[._-]/)[0] || local;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function roleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "editor":
      return "Editor";
    case "viewer":
      return "Viewer";
  }
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

export type ChartPoint = {
  date: string;
  val: number;
};

/** Count timestamps into one bucket per day, oldest first, ending today. */
export function bucketByDay(timestamps: string[], days: number, now = new Date()): ChartPoint[] {
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
  return [...counts.entries()].map(([key, val]) => {
    const [y, m, day] = key.split("-").map(Number);
    const d = new Date(y, m - 1, day);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      val,
    };
  });
}

/** Inside the last `days` calendar days, ending now. Future or bad dates are out. */
export function inDateWindow(timestamp: string | null, days: number, now = new Date()): boolean {
  if (!timestamp || days < 1) return false;
  const time = new Date(timestamp).getTime();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  return Number.isFinite(time) && time >= start.getTime() && time <= now.getTime();
}

/** Drafts created in the window, and posts actually published in it. */
export function draftWindow<Row extends { created_at: string; published_at: string | null; status: string }>(
  rows: Row[],
  days: number,
  now = new Date(),
): { created: Row[]; published: Row[]; publishedFromCreated: number } {
  const created = rows.filter((row) => inDateWindow(row.created_at, days, now));
  const published = rows.filter((row) => row.status === "published" && inDateWindow(row.published_at, days, now));
  return {
    created,
    published,
    publishedFromCreated: created.filter((row) => row.status === "published" && inDateWindow(row.published_at, days, now)).length,
  };
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Polyline points for a small sparkline in a w×h box. */
export function sparkPoints(values: number[], w = 96, h = 36): string {
  const vals = values.length > 1 ? values : [0, ...(values.length ? values : [0])];
  const max = Math.max(1, ...vals);
  const step = w / (vals.length - 1);
  return vals
    .map((v, i) => `${(i * step).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`)
    .join(" ");
}
