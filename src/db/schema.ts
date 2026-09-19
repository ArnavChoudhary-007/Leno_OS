import { pgTable, text, integer, real, jsonb, timestamp } from "drizzle-orm/pg-core";
import {
  CampaignStatusSchema,
  DraftStatusSchema,
  RunPhaseSchema,
} from "@/shared/schemas";
import type {
  CampaignStatus,
  CampaignSummary,
  Critique,
  DraftStatus,
  Plan,
  RunPhase,
} from "@/shared/types";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow();

// Enum values come from the zod schemas so there is one source of truth.
// zod hands back a plain array; drizzle's enum config wants a non-empty tuple.
function enumValues<T extends string>(values: readonly T[]): [T, ...T[]] {
  return values as unknown as [T, ...T[]];
}

const CAMPAIGN_STATUSES = enumValues(CampaignStatusSchema.options);
const DRAFT_STATUSES = enumValues(DraftStatusSchema.options);
const RUN_PHASES = enumValues(RunPhaseSchema.options);

// ---------------------------------------------------------------------------
// brand_profile — the company context shared by every agent
// ---------------------------------------------------------------------------

export const brandProfile = pgTable("brand_profile", {
  id: id(),
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
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// campaigns — one campaign brief driving one orchestrator run
// ---------------------------------------------------------------------------

export const campaigns = pgTable("campaigns", {
  id: id(),
  brief: text("brief").notNull(),
  goal: jsonb("goal").$type<Plan | null>(),
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
  started_at: timestamp("started_at", { withTimezone: true, mode: "string" }),
  finished_at: timestamp("finished_at", { withTimezone: true, mode: "string" }),
  created_at: createdAt(),
});

// ---------------------------------------------------------------------------
// drafts — one row per platform per revision round
// ---------------------------------------------------------------------------

export const drafts = pgTable("drafts", {
  id: id(),
  campaign_id: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  platform: text("platform").notNull(),
  version: integer("version").notNull().default(1),
  body: text("body").notNull(),
  image_url: text("image_url"),
  score: real("score"),
  scores: jsonb("scores").$type<Critique["scores"] | null>(),
  critic_notes: jsonb("critic_notes").$type<string[] | null>(),
  status: text("status", { enum: DRAFT_STATUSES })
    .notNull()
    .$type<DraftStatus>()
    .default("draft"),
  scheduled_at: timestamp("scheduled_at", {
    withTimezone: true,
    mode: "string",
  }),
  published_url: text("published_url"),
  /** A human's revision request, if this version came from one. */
  review_note: text("review_note"),
  created_at: createdAt(),
});

// ---------------------------------------------------------------------------
// run_steps — an append-only log of every orchestrator/agent step
// ---------------------------------------------------------------------------

export const runSteps = pgTable("run_steps", {
  id: id(),
  campaign_id: text("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  /** Which of the eight orchestrator phases this step belongs to. */
  phase: text("phase", { enum: RUN_PHASES }).$type<RunPhase | null>(),
  /** What ran inside that phase. */
  step: text("step").notNull(),
  /** The model that answered, or null for phases that are plain code. */
  model: text("model"),
  output: jsonb("output").notNull().$type<unknown>(),
  duration_ms: integer("duration_ms").notNull().default(0),
  created_at: createdAt(),
});
