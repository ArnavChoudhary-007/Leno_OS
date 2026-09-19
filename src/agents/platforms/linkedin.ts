import type { PlatformPlaybook } from "./types";
import { LINKEDIN_MAX_HASHTAGS } from "./linkedin-rules";

export const linkedinPlaybook: PlatformPlaybook = {
  id: "linkedin",
  displayName: "LinkedIn",
  enabled: true,
  maxChars: 3000,
  maxHashtags: LINKEDIN_MAX_HASHTAGS,
  formatNotes:
    "Short paragraphs of 2-3 sentences, not one sentence per line. Open with a concrete observation or number. Prefer under 1500 characters. Hashtags: at most 3, or none.",
  toneNotes:
    "Professional but human. Direct, specific, believable. No invented stories, no em dashes, no corporate filler, no Agree?/Thoughts? endings.",
  imageSpec: { width: 1024, height: 536, ratio: "1.91:1" },
};
