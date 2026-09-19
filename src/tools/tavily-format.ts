import type { ResearchBrief } from "@/shared/types";

export function buildResearchQuery(input: {
  brandName: string;
  brief: string;
  audience: string;
  keyMessage: string;
  angle: string;
  competitors: string[];
}): string {
  const parts = [
    input.brandName,
    input.keyMessage,
    input.angle,
    input.audience,
    input.brief,
    input.competitors.slice(0, 3).join(" "),
  ]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").slice(0, 400);
}

export function formatResearchBlock(brief: ResearchBrief): string {
  const sources = brief.sources
    .map((source, i) => `${i + 1}. ${source.title} — ${source.snippet}`)
    .join("\n");
  return [
    "=== LIVE RESEARCH (LinkedIn) ===",
    `Query: ${brief.query}`,
    brief.answer ? `Answer: ${brief.answer}` : null,
    sources ? `Sources:\n${sources}` : null,
    "Use a dated, relevant fact if it helps. Do not invent citations or dump URLs.",
    "=== END LIVE RESEARCH ===",
  ]
    .filter(Boolean)
    .join("\n");
}
