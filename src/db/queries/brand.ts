import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { brandProfile } from "@/db/schema";
import type { BrandProfile, BrandProfileInput } from "@/shared/types";

/**
 * Postgres/drizzle can round-trip `timestamptz` back as a
 * "YYYY-MM-DD HH:mm:ss.sss+00"-style string rather than strict ISO 8601 —
 * fine for V8 but not guaranteed elsewhere. Normalize at the boundary so
 * every `BrandProfile.updated_at` the app sees is a real ISO string.
 */
function normalize(row: BrandProfile): BrandProfile {
  return { ...row, updated_at: new Date(row.updated_at).toISOString() };
}

/** There is only ever meant to be one row in this table. */
export async function getBrandProfile(): Promise<BrandProfile | null> {
  const rows = await db
    .select()
    .from(brandProfile)
    .orderBy(desc(brandProfile.updated_at))
    .limit(1);

  return rows[0] ? normalize(rows[0]) : null;
}

/**
 * Inserts the brand profile if none exists yet, otherwise updates the
 * existing row and refreshes `updated_at`.
 */
export async function upsertBrandProfile(
  input: BrandProfileInput,
): Promise<BrandProfile> {
  const existing = await getBrandProfile();
  const updated_at = new Date().toISOString();
  // BrandProfileInputSchema enforces exactly 5 example posts; the column's
  // TS type is a fixed 5-tuple, string[] is not, hence the assertion.
  const example_posts = input.example_posts as [
    string,
    string,
    string,
    string,
    string,
  ];

  if (existing) {
    const [row] = await db
      .update(brandProfile)
      .set({ ...input, example_posts, updated_at })
      .where(eq(brandProfile.id, existing.id))
      .returning();
    return normalize(row);
  }

  const [row] = await db
    .insert(brandProfile)
    .values({ ...input, example_posts, updated_at })
    .returning();
  return normalize(row);
}
