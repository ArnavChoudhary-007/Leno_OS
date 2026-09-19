import type { PlatformPlaybook } from "./types";

export const xPlaybook: PlatformPlaybook = {
  id: "x",
  displayName: "X",
  enabled: true,
  maxChars: 280,
  maxHashtags: 3,
  formatNotes:
    "One idea per post. Front-load the hook in the first line — it's what shows before 'Show more'.",
  toneNotes: "Punchy, conversational, a little irreverent. Okay to be blunt.",
  imageSpec: { width: 1024, height: 576, ratio: "16:9" },
};
