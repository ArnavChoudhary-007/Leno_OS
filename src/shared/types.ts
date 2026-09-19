/**
 * Types inferred from the zod schemas in `@/shared/schemas`.
 * Do not hand-write shapes that duplicate a schema — infer them here.
 */
import { z } from "zod";
import type {
  BrandProfileInputSchema,
  BrandProfileSchema,
  CampaignBriefSchema,
  CampaignStatusSchema,
  CampaignSummarySchema,
  CritiqueLLMSchema,
  CritiqueLLMSetSchema,
  CritiqueSchema,
  CritiqueScoresSchema,
  DraftSchema,
  DraftSetSchema,
  DraftStatusSchema,
  PlanSchema,
  PlatformIdSchema,
  PlatformNotesSchema,
  ReviewNoteSchema,
  RunPhaseSchema,
  StrategySchema,
} from "./schemas";

export type PlatformId = z.infer<typeof PlatformIdSchema>;
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;
export type DraftStatus = z.infer<typeof DraftStatusSchema>;
export type RunPhase = z.infer<typeof RunPhaseSchema>;
export type ReviewNote = z.infer<typeof ReviewNoteSchema>;

export type BrandProfile = z.infer<typeof BrandProfileSchema>;
export type BrandProfileInput = z.infer<typeof BrandProfileInputSchema>;

export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;
export type CampaignSummary = z.infer<typeof CampaignSummarySchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type PlatformNotes = z.infer<typeof PlatformNotesSchema>;
export type Strategy = z.infer<typeof StrategySchema>;

export type Draft = z.infer<typeof DraftSchema>;
export type DraftSet = z.infer<typeof DraftSetSchema>;

export type CritiqueScores = z.infer<typeof CritiqueScoresSchema>;
export type CritiqueLLM = z.infer<typeof CritiqueLLMSchema>;
export type CritiqueLLMSet = z.infer<typeof CritiqueLLMSetSchema>;
export type Critique = z.infer<typeof CritiqueSchema>;
