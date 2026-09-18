import type { PlatformPlaybook } from "./types";

export const linkedinPlaybook: PlatformPlaybook = {
  id: "linkedin",
  displayName: "LinkedIn",
  enabled: true,
  maxChars: 3000,
  maxHashtags: 5,
  formatNotes:
    "Short paragraphs (1-2 lines) with line breaks between them. Lead with a concrete insight or result, not a generic statement.",
  toneNotes:
    "Professional but human. Confident and specific — avoid corporate filler and buzzwords.",
};
