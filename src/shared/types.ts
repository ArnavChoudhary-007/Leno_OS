/**
 * Types inferred from the zod schemas in `@/shared/schemas`.
 * Do not hand-write shapes that duplicate a schema — infer them here.
 */
import { z } from "zod";
import type {
  BrandProfileInputSchema,
  BrandProfileSchema,
  CampaignStatusSchema,
  CritiqueSchema,
  CritiqueScoresSchema,
  CritiqueSetSchema,
  DraftSchema,
  DraftSetSchema,
  DraftStatusSchema,
  PlanSchema,
  PlatformIdSchema,
  StrategySchema,
} from "./schemas";

export type PlatformId = z.infer<typeof PlatformIdSchema>;
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;
export type DraftStatus = z.infer<typeof DraftStatusSchema>;

export type BrandProfile = z.infer<typeof BrandProfileSchema>;
export type BrandProfileInput = z.infer<typeof BrandProfileInputSchema>;

export type Plan = z.infer<typeof PlanSchema>;
export type Strategy = z.infer<typeof StrategySchema>;

export type Draft = z.infer<typeof DraftSchema>;
export type DraftSet = z.infer<typeof DraftSetSchema>;

export type CritiqueScores = z.infer<typeof CritiqueScoresSchema>;
export type Critique = z.infer<typeof CritiqueSchema>;
export type CritiqueSet = z.infer<typeof CritiqueSetSchema>;
