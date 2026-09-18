import type { PlatformPlaybook } from "./types";

export const threadsPlaybook: PlatformPlaybook = {
  id: "threads",
  displayName: "Threads",
  enabled: true,
  maxChars: 500,
  // Threads uses a single topic tag rather than freeform hashtags.
  maxHashtags: 1,
  formatNotes:
    "Conversational, single topic tag at most. Written to invite replies, not just views.",
  toneNotes: "Casual, direct, a bit unfiltered. Fine to be opinionated.",
};
