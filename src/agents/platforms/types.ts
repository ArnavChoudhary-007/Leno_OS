import type { ImageFitSpec, PlatformId } from "@/shared/types";

/**
 * A typed playbook for one platform. Used both by writer/critic agents
 * (as prompt context) and by plain code (validateDraft) to enforce hard
 * limits before anything reaches a human or a publish step.
 */
export interface PlatformPlaybook {
  id: PlatformId;
  displayName: string;
  enabled: boolean;
  maxChars: number;
  /** Hashtag (or, for Threads, topic tag) count limit. */
  maxHashtags: number;
  /** Notes on structure/format the writer agent should follow. */
  formatNotes: string;
  /** Notes on tone/voice specific to this platform. */
  toneNotes: string;
  /** True if a draft for this platform must ship with an image. */
  requiresImage?: boolean;
  /** Feed image size (≤1024×1024). Generated or uploaded photos are cover-cropped to this. */
  imageSpec: ImageFitSpec;
}
