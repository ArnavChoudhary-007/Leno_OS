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
  CriticNotesSchema,
  CritiqueLLMSchema,
  CritiqueLLMSetSchema,
  CritiqueSchema,
  CritiqueScoresSchema,
  DraftReviewSchema,
  DraftSchema,
  DraftSetSchema,
  DraftStatusSchema,
  ErrorCodeSchema,
  PlanSchema,
  PlatformIdSchema,
  WorkspaceRoleSchema,
  PlatformNotesSchema,
  ReviewNoteSchema,
  RunPhaseSchema,
  StrategySchema,
  ImageFitSpecSchema,
  CoverCropBoxSchema,
  PublishDestinationsSchema,
  ResearchBriefSchema,
  ResearchSourceSchema,
} from "./schemas";

export type PlatformId = z.infer<typeof PlatformIdSchema>;
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;
export type DraftStatus = z.infer<typeof DraftStatusSchema>;
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type RunPhase = z.infer<typeof RunPhaseSchema>;
export type ReviewNote = z.infer<typeof ReviewNoteSchema>;

export type BrandProfile = z.infer<typeof BrandProfileSchema>;
export type BrandProfileInput = z.infer<typeof BrandProfileInputSchema>;

export type CampaignBrief = z.infer<typeof CampaignBriefSchema>;
export type CampaignSummary = z.infer<typeof CampaignSummarySchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type PlatformNotes = z.infer<typeof PlatformNotesSchema>;
export type Strategy = z.infer<typeof StrategySchema>;
export type ImageFitSpec = z.infer<typeof ImageFitSpecSchema>;
export type CoverCropBox = z.infer<typeof CoverCropBoxSchema>;

export type Draft = z.infer<typeof DraftSchema>;
export type DraftSet = z.infer<typeof DraftSetSchema>;
export type DraftReview = z.infer<typeof DraftReviewSchema>;

export type CritiqueScores = z.infer<typeof CritiqueScoresSchema>;
export type CritiqueLLM = z.infer<typeof CritiqueLLMSchema>;
export type CritiqueLLMSet = z.infer<typeof CritiqueLLMSetSchema>;
export type Critique = z.infer<typeof CritiqueSchema>;
export type CriticNotes = z.infer<typeof CriticNotesSchema>;
export type PublishDestinations = z.infer<typeof PublishDestinationsSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type ResearchBrief = z.infer<typeof ResearchBriefSchema>;

/** What ran inside a phase. Code-only phases log a step with no model. */
export type RunStepName =
  | "load_context"
  | "plan"
  | "strategy"
  | "roster"
  | "research"
  | "draft"
  | "image"
  | "critique"
  | "revise"
  | "summary"
  | "error";
