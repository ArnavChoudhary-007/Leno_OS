import type { PlatformId } from "@/shared/types";
import { xPlaybook } from "./x";
import { linkedinPlaybook } from "./linkedin";
import { instagramPlaybook } from "./instagram";
import { threadsPlaybook } from "./threads";
import { facebookPlaybook } from "./facebook";
import type { PlatformPlaybook } from "./types";

export type { PlatformPlaybook } from "./types";

/** Registry of every known platform playbook, including disabled ones. */
export const PLATFORM_PLAYBOOKS: Record<PlatformId, PlatformPlaybook> = {
  x: xPlaybook,
  linkedin: linkedinPlaybook,
  instagram: instagramPlaybook,
  threads: threadsPlaybook,
  facebook: facebookPlaybook,
};

/** Playbooks for platforms the orchestrator is currently allowed to use. */
export function getEnabledPlaybooks(): PlatformPlaybook[] {
  return Object.values(PLATFORM_PLAYBOOKS).filter((p) => p.enabled);
}

export interface DraftValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Hard gate on platform limits: character count and hashtag count.
 * This runs in plain code, before a draft ever reaches the critic agent.
 */
export function validateDraft(
  platformId: PlatformId,
  text: string,
  hashtags: string[] = [],
): DraftValidationResult {
  const playbook = PLATFORM_PLAYBOOKS[platformId];
  const errors: string[] = [];

  if (!playbook.enabled) {
    errors.push(`Platform "${platformId}" is not enabled.`);
  }
  if (text.length > playbook.maxChars) {
    errors.push(
      `Body is ${text.length} chars, exceeds ${playbook.displayName} limit of ${playbook.maxChars}.`,
    );
  }
  if (hashtags.length > playbook.maxHashtags) {
    errors.push(
      `${hashtags.length} hashtags/tags exceeds ${playbook.displayName} limit of ${playbook.maxHashtags}.`,
    );
  }

  return { valid: errors.length === 0, errors };
}
