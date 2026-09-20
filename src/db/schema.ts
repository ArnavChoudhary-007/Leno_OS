import {
  pgTable,
  text,
  integer,
  real,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  CAMPAIGN_STATUSES,
  DRAFT_STATUSES,
  RunPhaseSchema,
  WORKSPACE_ROLES,
} from "@/shared/schemas";
import type {
  CampaignStatus,
  CampaignSummary,
  CriticNotes,
  CritiqueScores,
  DraftStatus,
  Plan,
  RunPhase,
  WorkspaceRole,
} from "@/shared/types";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow();

const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });

// RunPhase has no raw array export in shared/schemas.ts (only the zod
// schema), so derive drizzle's enum tuple from it the same way the phase
// values themselves are defined — one source of truth either way.
function enumValues<T extends string>(values: readonly T[]): [T, ...T[]] {
  return values as unknown as [T, ...T[]];
}

const RUN_PHASES = enumValues(RunPhaseSchema.options);

// ---------------------------------------------------------------------------
// workspaces — one per user in v1; switcher is hidden
// ---------------------------------------------------------------------------

export const workspaces = pgTable("workspaces", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  default_timezone: text("default_timezone").notNull().default("UTC"),
  created_at: createdAt(),
  updated_at: timestamptz("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("workspaces_slug_uidx").on(t.slug)]);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: id(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    user_id: text("user_id").notNull(),
    role: text("role", { enum: WORKSPACE_ROLES })
      .notNull()
      .$type<WorkspaceRole>(),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex("workspace_members_workspace_user_uidx").on(
      t.workspace_id,
      t.user_id,
    ),
    uniqueIndex("workspace_members_user_uidx").on(t.user_id),
  ],
);

export const workspaceInvites = pgTable(
  "workspace_invites",
  {
    id: id(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: WORKSPACE_ROLES })
      .notNull()
      .$type<WorkspaceRole>(),
    token_hash: text("token_hash").notNull(),
    invited_by: text("invited_by").notNull(),
    expires_at: timestamptz("expires_at").notNull(),
    accepted_at: timestamptz("accepted_at"),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex("workspace_invites_token_hash_uidx").on(t.token_hash)],
);

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  window_start: timestamptz("window_start").notNull(),
  count: integer("count").notNull(),
});

// ---------------------------------------------------------------------------
// platform_connections — OAuth tokens per workspace (LinkedIn first)
// ---------------------------------------------------------------------------

export const platformConnections = pgTable(
  "platform_connections",
  {
    id: id(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    account_name: text("account_name").notNull(),
    account_urn: text("account_urn").notNull(),
    access_token: text("access_token").notNull(),
    refresh_token: text("refresh_token"),
    expires_at: timestamptz("expires_at").notNull(),
    scopes: text("scopes").notNull().default(""),
    created_at: createdAt(),
    updated_at: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("platform_connections_workspace_platform_uidx").on(
      t.workspace_id,
      t.platform,
    ),
  ],
);

// ---------------------------------------------------------------------------
// brand_profile — one brand per workspace in v1
// ---------------------------------------------------------------------------

export const brandProfile = pgTable(
  "brand_profile",
  {
    id: id(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    one_liner: text("one_liner").notNull(),
    positioning: text("positioning").notNull(),
    audience: text("audience").notNull(),
    products: jsonb("products").notNull().$type<string[]>(),
    competitors: jsonb("competitors").notNull().$type<string[]>(),
    tone_words: jsonb("tone_words").notNull().$type<string[]>(),
    dos: jsonb("dos").notNull().$type<string[]>(),
    donts: jsonb("donts").notNull().$type<string[]>(),
    example_posts: jsonb("example_posts")
      .notNull()
      .$type<[string, string, string, string, string]>(),
    primary_color: text("primary_color").notNull(),
    secondary_color: text("secondary_color").notNull(),
    updated_at: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("brand_profile_workspace_uidx").on(t.workspace_id)],
);

// ---------------------------------------------------------------------------
// campaigns — one campaign brief driving one orchestrator run
// ---------------------------------------------------------------------------

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    brand_id: text("brand_id").references(() => brandProfile.id, {
      onDelete: "set null",
    }),
    created_by: text("created_by").notNull(),
    brief: text("brief").notNull(),
    /** Denormalized plan.goal for display/filter; full plan is in `plan`. */
    goal: text("goal"),
    plan: jsonb("plan").$type<Plan | null>(),
    status: text("status", { enum: CAMPAIGN_STATUSES })
      .notNull()
      .$type<CampaignStatus>()
      .default("queued"),
    /** What the run delivered, per platform, plus totals. Written at the end. */
    summary: jsonb("summary").$type<CampaignSummary | null>(),
    /** The exact brand card the agents saw, kept so a run stays reproducible. */
    brand_snapshot: text("brand_snapshot"),
    llm_calls: integer("llm_calls").notNull().default(0),
    /** Set when a run is claimed; used to reclaim stale `running` rows. */
    started_at: timestamptz("started_at"),
    finished_at: timestamptz("finished_at"),
    created_at: createdAt(),
  },
  (t) => [
    index("campaigns_workspace_created_idx").on(t.workspace_id, t.created_at),
  ],
);

// ---------------------------------------------------------------------------
// drafts — one row per platform per revision round
// ---------------------------------------------------------------------------

export const drafts = pgTable(
  "drafts",
  {
    id: id(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    version: integer("version").notNull().default(1),
    /** Post text without hashtags. Publish path composes with `hashtags`. */
    body: text("body").notNull(),
    hashtags: jsonb("hashtags").notNull().$type<string[]>().default([]),
    image_url: text("image_url"),
    score: real("score"),
    scores: jsonb("scores").$type<CritiqueScores | null>(),
    critic_notes: jsonb("critic_notes").$type<CriticNotes | null>(),
    status: text("status", { enum: DRAFT_STATUSES })
      .notNull()
      .$type<DraftStatus>()
      .default("draft"),
    /** Approver note when rejecting; fed into the next revision. */
    review_note: text("review_note"),
    scheduled_at: timestamptz("scheduled_at"),
    published_url: text("published_url"),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex("drafts_campaign_platform_version_uidx").on(
      t.campaign_id,
      t.platform,
      t.version,
    ),
    index("drafts_workspace_campaign_idx").on(t.workspace_id, t.campaign_id),
  ],
);

// ---------------------------------------------------------------------------
// run_steps — an append-only log of every orchestrator/agent step
// ---------------------------------------------------------------------------

export const runSteps = pgTable(
  "run_steps",
  {
    id: id(),
    workspace_id: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaign_id: text("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    /** Which of the eight orchestrator phases this step belongs to. */
    phase: text("phase", { enum: RUN_PHASES }).$type<RunPhase | null>(),
    /** What ran inside that phase. */
    step: text("step").notNull(),
    /** The model that answered, or null for phases that are plain code. */
    model: text("model"),
    output: jsonb("output").notNull().$type<unknown>(),
    duration_ms: integer("duration_ms").notNull().default(0),
    created_at: createdAt(),
  },
  (t) => [
    index("run_steps_campaign_created_idx").on(t.campaign_id, t.created_at),
  ],
);
