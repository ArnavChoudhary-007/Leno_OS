/**
 * ALL zod schemas for the app live in this file. Do not define schemas
 * elsewhere — import from here (and from `@/shared/types` for the
 * inferred TypeScript types) instead of redeclaring shapes.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const PlatformIdSchema = z.enum([
  "x",
  "linkedin",
  "instagram",
  "threads",
  "facebook",
]);

export const CampaignStatusSchema = z.enum([
  "queued",
  "running",
  "needs_human",
  "ready",
  "failed",
]);

export const DraftStatusSchema = z.enum([
  "draft",
  "needs_human",
  "approved",
  "rejected",
  "published",
]);

// ---------------------------------------------------------------------------
// Company context
// ---------------------------------------------------------------------------

export const BrandProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  one_liner: z.string(),
  positioning: z.string(),
  audience: z.string(),
  products: z.array(z.string()),
  competitors: z.array(z.string()),
  tone_words: z.array(z.string()),
  dos: z.array(z.string()),
  donts: z.array(z.string()),
  example_posts: z.array(z.string()).length(5),
  primary_color: z.string(),
  secondary_color: z.string(),
  updated_at: z.string(),
});

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * What the /brand form actually accepts: BrandProfile minus the fields the
 * server owns (id, updated_at), with the validation rules the UI enforces.
 */
export const BrandProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Required").max(80, "80 characters max"),
  one_liner: z
    .string()
    .trim()
    .min(1, "Required")
    .max(160, "160 characters max"),
  positioning: z.string().trim().min(1, "Required"),
  audience: z.string().trim().min(1, "Required"),
  products: z.array(z.string().trim().min(1)).max(10, "10 items max"),
  competitors: z.array(z.string().trim().min(1)).max(10, "10 items max"),
  tone_words: z
    .array(z.string().trim().min(1))
    .min(3, "At least 3 tone words")
    .max(6, "At most 6 tone words"),
  dos: z
    .array(z.string().trim().min(1))
    .min(1, "At least 1 item")
    .max(10, "10 items max"),
  donts: z
    .array(z.string().trim().min(1))
    .min(1, "At least 1 item")
    .max(10, "10 items max"),
  example_posts: z
    .array(z.string().trim().min(20, "At least 20 characters"))
    .length(5, "Exactly 5 example posts"),
  primary_color: z
    .string()
    .regex(HEX_COLOR_REGEX, "Must be a hex color like #1A2B3C"),
  secondary_color: z
    .string()
    .regex(HEX_COLOR_REGEX, "Must be a hex color like #1A2B3C"),
});

// ---------------------------------------------------------------------------
// Orchestrator: plan + strategy
// ---------------------------------------------------------------------------

export const PlanSchema = z.object({
  goal: z.string(),
  audience: z.string(),
  key_message: z.string(),
  platforms: z.array(PlatformIdSchema),
});

export const StrategySchema = z.object({
  angle: z.string(),
  hooks: z.array(z.string()),
  cta: z.string(),
});

// ---------------------------------------------------------------------------
// Creative production
// ---------------------------------------------------------------------------

export const DraftSchema = z.object({
  platform: PlatformIdSchema,
  body: z.string(),
  hashtags: z.array(z.string()),
});

export const DraftSetSchema = z.object({
  drafts: z.array(DraftSchema),
});

// ---------------------------------------------------------------------------
// QA / Critic
// ---------------------------------------------------------------------------

export const CritiqueScoresSchema = z.object({
  brand_voice: z.number().min(0).max(1),
  goal_fit: z.number().min(0).max(1),
  platform_fit: z.number().min(0).max(1),
  craft: z.number().min(0).max(1),
});

export const CritiqueSchema = z.object({
  platform: PlatformIdSchema,
  scores: CritiqueScoresSchema,
  weighted: z.number().min(0).max(1),
  pass: z.boolean(),
  fix_list: z.array(z.string()),
});

export const CritiqueSetSchema = z.object({
  critiques: z.array(CritiqueSchema),
});
