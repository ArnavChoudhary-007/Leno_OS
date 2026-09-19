import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitBuckets } from "@/db/schema";
import { AppError } from "@/shared/errors";

export type RateLimit = {
  key: string;
  max: number;
  windowMs: number;
};

/**
 * Postgres-backed fixed window. One row per key. When the window has
 * elapsed the count resets to 1. Throws AppError("rate_limited") when
 * the bump would exceed `max`.
 */
export async function consumeRateLimit(limit: RateLimit): Promise<void> {
  const now = new Date();
  const windowStartIso = now.toISOString();

  const [existing] = await db
    .select()
    .from(rateLimitBuckets)
    .where(eq(rateLimitBuckets.key, limit.key))
    .limit(1);

  if (!existing) {
    try {
      await db.insert(rateLimitBuckets).values({
        key: limit.key,
        window_start: windowStartIso,
        count: 1,
      });
      return;
    } catch (err) {
      const code =
        typeof err === "object" && err && "code" in err
          ? String(err.code)
          : "";
      if (code !== "23505") throw err;
      // Concurrent first insert — treat as an existing bucket.
    }
    const [raced] = await db
      .select()
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.key, limit.key))
      .limit(1);
    if (!raced) throw new AppError("rate_limited");
    return consumeExisting(limit, raced, now, windowStartIso);
  }

  return consumeExisting(limit, existing, now, windowStartIso);
}

async function consumeExisting(
  limit: RateLimit,
  existing: typeof rateLimitBuckets.$inferSelect,
  now: Date,
  windowStartIso: string,
): Promise<void> {

  const windowStart = new Date(existing.window_start).getTime();
  const expired = now.getTime() - windowStart >= limit.windowMs;

  if (expired) {
    await db
      .update(rateLimitBuckets)
      .set({ window_start: windowStartIso, count: 1 })
      .where(eq(rateLimitBuckets.key, limit.key));
    return;
  }

  if (existing.count >= limit.max) {
    throw new AppError("rate_limited");
  }

  const bumped = await db
    .update(rateLimitBuckets)
    .set({ count: sql`${rateLimitBuckets.count} + 1` })
    .where(
      and(
        eq(rateLimitBuckets.key, limit.key),
        lt(rateLimitBuckets.count, limit.max),
      ),
    )
    .returning({ count: rateLimitBuckets.count });

  if (bumped.length === 0) {
    throw new AppError("rate_limited");
  }
}

export const RATE_LIMITS = {
  authIp: (ip: string): RateLimit => ({
    key: `auth:${ip}`,
    max: 20,
    windowMs: 15 * 60 * 1000,
  }),
  authEmail: (email: string): RateLimit => ({
    key: `auth:${email.toLowerCase()}`,
    max: 10,
    windowMs: 15 * 60 * 1000,
  }),
  campaignCreate: (userId: string): RateLimit => ({
    key: `campaign_create:${userId}`,
    max: 10,
    windowMs: 60 * 60 * 1000,
  }),
  draftMutate: (userId: string): RateLimit => ({
    key: `draft_mutate:${userId}`,
    max: 60,
    windowMs: 60 * 60 * 1000,
  }),
  imageGenerate: (workspaceId: string): RateLimit => ({
    key: `image_generate:${workspaceId}`,
    max: 20,
    windowMs: 60 * 60 * 1000,
  }),
  tavilySearch: (workspaceId: string): RateLimit => ({
    key: `tavily_search:${workspaceId}`,
    max: 30,
    windowMs: 60 * 60 * 1000,
  }),
} as const;
