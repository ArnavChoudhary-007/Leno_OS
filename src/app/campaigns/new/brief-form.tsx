"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PLATFORM_PLAYBOOKS, composePost } from "@/agents/platforms";
import { ArrowIcon } from "@/components/app-chrome";
import { EditorDrawer, type EditorDraft } from "@/components/leno/editor-drawer";
import { apiErrorMessage } from "@/lib/api-error";
import { reviewDraftOrThrow } from "@/lib/review-draft";
import { CREATE_PLATFORMS, platformLabel } from "@/lib/workspace-ui";
import type { CampaignStatus, PlatformId } from "@/shared/types";

const TONES = ["Confident", "Friendly", "Expert", "Playful"] as const;

/** What each platform's card promises before anything is written. */
const FORMAT: Record<PlatformId, string> = {
  linkedin: "Up to 3,000 characters",
  x: "Up to 280 characters",
  instagram: "Caption and feed image",
  threads: "Up to 500 characters",
  facebook: "Page post",
};

const LIMIT_WORD: Record<PlatformId, string> = {
  linkedin: "3,000 character limit",
  x: "280 character limit",
  instagram: "caption length and hashtag count",
  threads: "500 character limit",
  facebook: "Page post rules",
};

/** The seven bars under the form, and which run steps fill them. */
const STAGES = [
  { label: "Understand brief", steps: ["load_context"] },
  { label: "Plan", steps: ["plan", "strategy"] },
  { label: "Research", steps: ["research"] },
  { label: "Draft", steps: ["roster", "draft"] },
  { label: "Image", steps: ["image"] },
  { label: "Quality check", steps: ["critique", "revise"] },
  { label: "Ready for review", steps: ["summary"] },
] as const;

const TERMINAL: CampaignStatus[] = ["ready", "needs_human", "failed"];

type RunDraft = EditorDraft & { version: number };

type RunPayload = {
  campaign: { id: string; status: CampaignStatus; plan: { platforms: PlatformId[] } | null };
  steps: { step: string }[];
  drafts: RunDraft[];
};

export function BriefForm({
  brandName,
  hasBrand,
}: {
  brandName: string | null;
  hasBrand: boolean;
}) {
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Confident");
  const [showMore, setShowMore] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [on, setOn] = useState<Record<string, boolean>>({
    linkedin: true,
    x: true,
    instagram: true,
    threads: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [requested, setRequested] = useState<PlatformId[]>([]);
  const [run, setRun] = useState<RunPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [approving, setApproving] = useState<Record<string, boolean>>({});
  const [tick, setTick] = useState(0);
  const postsRef = useRef<HTMLElement>(null);

  const status = run?.campaign.status ?? (campaignId ? "queued" : null);
  const busy = submitting || (campaignId !== null && status !== null && !TERMINAL.includes(status));
  const finished = status === "ready" || status === "needs_human";
  const failed = status === "failed";

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/campaigns/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    setRun((await res.json()) as RunPayload);
  }, []);

  // Poll the live run until it lands; tick drives the rotating messages.
  useEffect(() => {
    if (!campaignId || !busy) return;
    const poll = window.setInterval(() => void load(campaignId), 1200);
    const ticker = window.setInterval(() => setTick((t) => t + 1), 1400);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(ticker);
    };
  }, [campaignId, busy, load]);

  // Toast once when the run finishes.
  const lastStatus = useRef<CampaignStatus | null>(null);
  useEffect(() => {
    if (!status || lastStatus.current === status) return;
    const prev = lastStatus.current;
    lastStatus.current = status;
    if (!prev) return;
    if (status === "ready") toast.success("Your posts are ready for review");
    if (status === "needs_human") toast("Posts are ready — some need a closer look");
    if (status === "failed") toast.error("The run stopped before finishing");
  }, [status]);

  const selected = CREATE_PLATFORMS.filter((p) => on[p]);
  const shown: PlatformId[] = campaignId ? requested : selected;

  const draftsByPlatform = useMemo(() => {
    const map = new Map<string, RunDraft>();
    for (const d of run?.drafts ?? []) map.set(d.platform, d);
    return map;
  }, [run]);

  const stageIndex = useMemo(() => {
    if (finished) return STAGES.length;
    let reached = -1;
    for (const step of run?.steps ?? []) {
      const idx = STAGES.findIndex((s) => (s.steps as readonly string[]).includes(step.step));
      if (idx > reached) reached = idx;
    }
    return reached;
  }, [run, finished]);

  function toggle(id: PlatformId) {
    if (busy) return;
    setOn((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function composeBrief(): string {
    const lines = [idea.trim()];
    if (audience.trim()) lines.push("", `Audience: ${audience.trim()}`);
    if (showMore || tone !== "Confident") lines.push(`Tone: ${tone}`);
    return lines.join("\n");
  }

  async function start(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    if (selected.length === 0) {
      toast.error("Pick at least one platform");
      return;
    }
    if (idea.trim().length < 20) {
      setError("Give Leno a little more to go on: at least 20 characters.");
      document.getElementById("idea")?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("brief", composeBrief());
      for (const p of selected) body.append("platforms", p);
      if (image) body.set("image", image);
      const res = await fetch("/api/campaigns", { method: "POST", body });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(apiErrorMessage(data, `Request failed (${res.status})`));
        return;
      }
      if (data && typeof data === "object" && "id" in data && typeof data.id === "string") {
        lastStatus.current = null;
        setRun(null);
        setCopied({});
        setRequested(selected);
        setCampaignId(data.id);
        void load(data.id);
        window.setTimeout(() => postsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function retry() {
    if (!campaignId) return;
    const res = await fetch(`/api/campaigns/${campaignId}`, { method: "POST" });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(apiErrorMessage(data, `Retry failed (${res.status})`));
      return;
    }
    lastStatus.current = "queued";
    toast.success("Running it again");
    void load(campaignId);
  }

  async function approve(draft: RunDraft) {
    setApproving((a) => ({ ...a, [draft.id]: true }));
    try {
      await reviewDraftOrThrow(draft.campaign_id, draft.id, { action: "approve" });
      toast.success(`${platformLabel(draft.platform)} post approved and moved to Track`);
      if (campaignId) await load(campaignId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setApproving((a) => ({ ...a, [draft.id]: false }));
    }
  }

  async function approveAll() {
    const pending = (run?.drafts ?? []).filter((d) => d.status === "draft" || d.status === "needs_human");
    if (pending.length === 0) return;
    try {
      for (const d of pending) {
        await reviewDraftOrThrow(d.campaign_id, d.id, { action: "approve" });
      }
      toast.success(`${pending.length} post${pending.length === 1 ? "" : "s"} approved and moved to Track`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed");
    }
    if (campaignId) await load(campaignId);
  }

  async function copy(draft: RunDraft) {
    try {
      await navigator.clipboard.writeText(composePost({ platform: draft.platform as PlatformId, body: draft.body, hashtags: draft.hashtags }));
      setCopied((c) => ({ ...c, [draft.id]: true }));
      window.setTimeout(() => setCopied((c) => ({ ...c, [draft.id]: false })), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  const drafts = run?.drafts ?? [];
  const approvedCount = drafts.filter((d) => d.status === "approved" || d.status === "published").length;
  const waitingCount = drafts.filter((d) => d.status === "draft" || d.status === "needs_human").length;

  let statusLine = "Pick your platforms and write the idea above";
  if (busy) {
    const ready = shown.filter((p) => draftsByPlatform.has(p)).length;
    statusLine = ready > 0 ? `${ready} of ${shown.length} drafted, the critic is checking them` : `Writing ${shown.length} posts, one per platform`;
  } else if (finished) {
    statusLine =
      approvedCount === drafts.length && drafts.length > 0
        ? "All approved. They’re in Track, ready to schedule or publish"
        : `${drafts.length} post${drafts.length === 1 ? "" : "s"} ready. Read them, edit anything, then approve`;
  } else if (failed) {
    statusLine = "The run stopped before it finished";
  }

  const editorDrafts = drafts.filter((d) => shown.includes(d.platform as PlatformId));

  return (
    <>
      <section className="l-create-hero">
        <div className="l-create-hero-top">
          <SayItOnce />
          <div className="l-create-lede">
            <p>
              Tell Leno what your customers should hear, and it writes a native post for each platform
              you pick, checked against that platform’s rules
            </p>
            <p className="l-create-lede-strong">
              Nothing goes live until <span className="l-lime">you approve it</span>
            </p>
          </div>
        </div>

        {!hasBrand ? (
          <div className="l-notice" role="note">
            <span className="l-notice-pill">1</span>
            <span className="l-notice-text">
              Leno writes in your brand’s voice, so it needs a brand card first
            </span>
            <Link href="/brand" className="l-btn l-btn-outline">
              Set up the brand card
            </Link>
          </div>
        ) : null}

        <form onSubmit={start} className="l-idea" aria-busy={busy}>
          <div className="l-idea-main">
            <label htmlFor="idea" className="l-idea-label">
              What do you want to tell your customers?
            </label>
            <textarea
              id="idea"
              rows={2}
              value={idea}
              maxLength={1800}
              onChange={(e) => {
                setIdea(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void start();
              }}
              placeholder="Most AI prototypes never reach production, and it isn't the model's fault"
              className="l-idea-input"
              aria-describedby={error ? "idea-error" : undefined}
              aria-invalid={error ? true : undefined}
              disabled={busy}
            />
          </div>

          {showMore ? (
            <div className="l-idea-more l-reveal">
              <div className="l-field">
                <label htmlFor="aud" className="l-label">
                  Who is it for
                </label>
                <input
                  id="aud"
                  className="l-input l-input-deep"
                  value={audience}
                  maxLength={160}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Founders and engineering leads"
                  disabled={busy}
                />
              </div>
              <div className="l-field">
                <label htmlFor="tone" className="l-label">
                  Tone
                </label>
                <select
                  id="tone"
                  className="l-input l-input-deep"
                  value={tone}
                  onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}
                  disabled={busy}
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="l-field">
                <label htmlFor="photo" className="l-label">
                  Your own photo (optional)
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="l-file"
                  onChange={(e) => setImage(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
              </div>
            </div>
          ) : null}

          <div className="l-idea-foot">
            <fieldset className="l-chips">
              <legend className="l-chips-legend">Post to</legend>
              {CREATE_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="l-chip"
                  aria-pressed={!!on[p]}
                  onClick={() => toggle(p)}
                  disabled={busy}
                >
                  {platformLabel(p)}
                </button>
              ))}
            </fieldset>
            <button
              type="button"
              className="l-more-btn"
              aria-expanded={showMore}
              onClick={() => setShowMore((v) => !v)}
            >
              {showMore ? "Hide audience and tone" : "Add audience and tone"}
            </button>
            <button type="submit" className="l-cta l-idea-go" disabled={busy || !hasBrand}>
              <span>{busy ? "Writing" : finished ? "Write again" : "Write the posts"}</span>
              <ArrowIcon />
            </button>
          </div>
          {busy ? <div className="l-rainline" aria-hidden="true" /> : null}
        </form>

        {error ? (
          <p id="idea-error" role="alert" className="l-form-error">
            {error}
            {error.toLowerCase().includes("brand") ? (
              <>
                {" "}
                <Link href="/brand" className="l-link-lime">
                  Open Settings
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        {campaignId ? (
          <ol aria-label="Pipeline" className="l-stages">
            {STAGES.map((s, i) => {
              const done = finished || i < stageIndex;
              const live = busy && i === Math.max(stageIndex, 0) && !done;
              const broke = failed && i === Math.max(stageIndex, 0);
              return (
                <li key={s.label} className={`l-stage${done ? " is-done" : ""}${live ? " is-live" : ""}${broke ? " is-failed" : ""}`}>
                  <span aria-hidden="true" className="l-stage-bar" />
                  <span className="l-stage-label">
                    {s.label}
                    {live ? <span className="sr-only-l"> (in progress)</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      <section id="posts" ref={postsRef} aria-labelledby="posts-h" className="l-posts">
        <div className="l-posts-head">
          <h2 id="posts-h" className="l-h2">
            Your posts
          </h2>
          <p aria-live="polite" className="l-posts-status">
            {statusLine}
          </p>
          {finished && waitingCount > 0 ? (
            <button type="button" className="l-btn l-btn-outline" onClick={() => void approveAll()}>
              Approve all {waitingCount}
            </button>
          ) : null}
          {finished && waitingCount === 0 && drafts.length > 0 ? (
            <Link href="/track" className="l-btn l-btn-outline">
              Open Track
            </Link>
          ) : null}
          {failed ? (
            <button type="button" className="l-btn l-btn-outline" onClick={() => void retry()}>
              Try again
            </button>
          ) : null}
          {campaignId ? (
            <Link href={`/campaigns/${campaignId}`} className="l-link">
              Full run details
            </Link>
          ) : null}
        </div>

        {shown.length === 0 ? (
          <p className="l-muted">Pick at least one platform above.</p>
        ) : (
          <div className="l-post-grid">
            {shown.map((p, i) => {
              const draft = draftsByPlatform.get(p);
              const name = platformLabel(p);
              const state: "empty" | "loading" | "ready" | "missing" = !campaignId
                ? "empty"
                : draft && !busy
                  ? "ready"
                  : busy
                    ? "loading"
                    : "missing";
              if (state === "empty") {
                return (
                  <article key={p} className="l-post is-empty">
                    <PostHeader name={name} fmt={FORMAT[p]} />
                    <div className="l-post-empty">
                      <span aria-hidden="true" style={{ width: "82%" }} />
                      <span aria-hidden="true" style={{ width: "64%" }} />
                      <span aria-hidden="true" style={{ width: "74%" }} />
                      <p>Your {name} draft lands here</p>
                    </div>
                  </article>
                );
              }
              if (state === "loading") {
                const msgs = loadingMessages(p, run?.steps.at(-1)?.step);
                return (
                  <article key={p} className="l-post" aria-busy="true">
                    <PostHeader name={name} fmt={FORMAT[p]} />
                    <div className="l-rb" aria-hidden="true">
                      <div className="l-rb-spin" />
                      <div className="l-rb-blobs" />
                      <div className="l-rb-sweep" />
                      <div className="l-rb-grain" />
                      <div className="l-rb-lines">
                        <div className="l-sk" style={{ width: "86%" }} />
                        <div className="l-sk" style={{ width: "64%" }} />
                        <div className="l-sk" style={{ width: "78%" }} />
                        <div className="l-sk" style={{ width: "40%" }} />
                      </div>
                    </div>
                    <p className="l-post-msg">
                      <span aria-hidden="true" className="l-sq" />
                      <span>{msgs[(Math.floor(tick / 2) + i) % msgs.length]}</span>
                    </p>
                  </article>
                );
              }
              if (state === "missing" || !draft) {
                return (
                  <article key={p} className="l-post">
                    <PostHeader name={name} fmt={FORMAT[p]} />
                    <div className="l-post-empty">
                      <p>
                        {failed
                          ? `The run stopped before the ${name} post was written.`
                          : `The planner didn’t write a ${name} post for this idea.`}
                      </p>
                    </div>
                  </article>
                );
              }
              const text = composePost({ platform: p, body: draft.body, hashtags: draft.hashtags });
              const max = PLATFORM_PLAYBOOKS[p]?.maxChars ?? 0;
              const over = max > 0 && text.length > max;
              const approved = draft.status === "approved" || draft.status === "published";
              return (
                <article key={p} className={`l-post is-ready${approved ? " is-approved" : ""}`}>
                  <PostHeader name={name} fmt={FORMAT[p]} />
                  <div className="l-reveal l-post-body">
                    {draft.image_url ? (
                      <figure className="l-post-figure">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={draft.image_url} alt={`Image for the ${name} post`} />
                      </figure>
                    ) : null}
                    <p className="l-post-text">{text}</p>
                    {draft.status === "needs_human" ? (
                      <p className="l-post-flag">The critic couldn’t get this one past 0.80, read it closely</p>
                    ) : null}
                    <footer className="l-post-foot">
                      <span className={`l-count${over ? " is-over" : ""}`}>
                        {max ? `${text.length.toLocaleString()} / ${max.toLocaleString()}` : `${text.length} characters`}
                        {draft.score != null ? ` · score ${draft.score.toFixed(2)}` : ""}
                      </span>
                      <button type="button" className="l-btn l-btn-ghost l-btn-sm" onClick={() => setEditing(draft.id)}>
                        Edit
                      </button>
                      <button type="button" className="l-btn l-btn-ghost l-btn-sm" onClick={() => void copy(draft)}>
                        {copied[draft.id] ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        className={`l-btn l-btn-sm ${approved ? "l-approved" : "l-btn-light"}`}
                        disabled={approved || approving[draft.id]}
                        onClick={() => void approve(draft)}
                      >
                        {draft.status === "published" ? "Published" : approved ? "Approved" : "Approve"}
                      </button>
                    </footer>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <EditorDrawer
        drafts={editorDrafts}
        openId={editing}
        author={{
          name: brandName ?? "Your brand",
          handle: (brandName ?? "yourbrand").toLowerCase().replace(/\s+/g, ""),
        }}
        canMutate
        onClose={() => setEditing(null)}
        onChanged={() => {
          if (campaignId) void load(campaignId);
        }}
      />
    </>
  );
}

function PostHeader({ name, fmt }: { name: string; fmt: string }) {
  return (
    <header className="l-post-head">
      <h3>{name}</h3>
      <span>{fmt}</span>
    </header>
  );
}

function loadingMessages(p: PlatformId, lastStep: string | undefined): string[] {
  const name = platformLabel(p);
  if (lastStep === "critique" || lastStep === "revise") {
    return [`Critic is scoring the ${name} draft`, "Tightening the first line", `Checking the ${LIMIT_WORD[p]}`];
  }
  if (lastStep === "draft" || lastStep === "image") {
    return [`Checking the ${LIMIT_WORD[p]}`, "Critic is scoring the draft", "Tightening the first line"];
  }
  return ["Reading your brand voice", `Writing the ${name} version`, `Checking the ${LIMIT_WORD[p]}`];
}

/** "SAY IT ONCE", each letter knocked slightly off its baseline. */
function SayItOnce() {
  const rots = [-4, 3, -2, 5, -3, 2, -5, 4, -2];
  const lifts = [0, -6, 4, -2, 6, -4, 2, -6, 0];
  let n = 0;
  return (
    <h1 aria-label="Say it once" className="l-say">
      {["Say", "it", "once"].map((word, wi) => (
        <span key={word} aria-hidden="true" className={`l-say-word${wi === 2 ? " l-lime" : ""}`}>
          {word.split("").map((ch) => {
            const k = n++;
            return (
              <span
                key={k}
                className="l-say-ch"
                style={{ transform: `rotate(${rots[k % rots.length]}deg) translateY(${lifts[k % lifts.length]}px)` }}
              >
                {ch}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}
