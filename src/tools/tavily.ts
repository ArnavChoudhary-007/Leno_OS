import { z } from "zod";
import { env } from "@/env";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { AppError } from "@/shared/errors";
import { ResearchBriefSchema } from "@/shared/schemas";
import type { ResearchBrief } from "@/shared/types";
import { buildResearchQuery } from "./tavily-format";

export { buildResearchQuery, formatResearchBlock } from "./tavily-format";

const TIMEOUT_MS = 20_000;
const MAX_RESULTS = 5;
const SNIPPET_CHARS = 400;

const TavilyHitSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  content: z.string().optional(),
});

const TavilyResponseSchema = z.object({
  answer: z.string().optional(),
  results: z.array(TavilyHitSchema).optional(),
});

export function tavilyConfigured(): boolean {
  return Boolean(env.TAVILY_API_KEY?.trim());
}

/**
 * Tavily search for the LinkedIn writer. Returns null when unset, rate
 * limited, or the request fails — research must never fail a campaign.
 */
export async function researchForLinkedIn(input: {
  workspaceId: string;
  brandName: string;
  brief: string;
  audience: string;
  keyMessage: string;
  angle: string;
  competitors: string[];
}): Promise<ResearchBrief | null> {
  const apiKey = env.TAVILY_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    await consumeRateLimit(RATE_LIMITS.tavilySearch(input.workspaceId));
  } catch (err) {
    if (err instanceof AppError && err.code === "rate_limited") return null;
    throw err;
  }

  const query = buildResearchQuery(input);
  if (!query) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: MAX_RESULTS,
        include_answer: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[tavily] search failed (${res.status}): ${body.slice(0, 200)}`);
      return null;
    }

    const parsed = TavilyResponseSchema.parse(await res.json());
    const sources = (parsed.results ?? [])
      .filter((hit) => hit.url && hit.title)
      .slice(0, MAX_RESULTS)
      .map((hit) => ({
        title: hit.title!.trim().slice(0, 160),
        url: hit.url!,
        snippet: (hit.content ?? "").replace(/\s+/g, " ").trim().slice(0, SNIPPET_CHARS),
      }));

    return ResearchBriefSchema.parse({
      query,
      answer: (parsed.answer ?? "").trim().slice(0, 800),
      sources,
    });
  } catch (err) {
    console.error("[tavily] search error:", err instanceof Error ? err.message : err);
    return null;
  }
}
