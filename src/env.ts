/**
 * Fails fast on bad config instead of surfacing deep inside an agent or db
 * call. SKIP_ENV_VALIDATION=1 bypasses it for the Docker build, which
 * compiles before any secret exists.
 *
 * Do not import this module from a Client Component. Service-role and
 * DATABASE_URL must never ship to the browser.
 */
import { z } from "zod";

const envSchema = z.object({
  // Public origin for redirects and same-origin checks on mutating APIs.
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Supabase project API (Settings → API). Server-only; do not prefix
  // SUPABASE_SERVICE_ROLE_KEY with NEXT_PUBLIC_.
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Supabase Postgres, via postgres.js + Drizzle. Copy the URI from
  // Project Settings → Database (prefer Session/Direct for migrations;
  // Transaction pooler is fine for the app). See .env.example.
  DATABASE_URL: z
    .string()
    .min(1)
    .regex(
      /^postgres(ql)?:\/\//,
      "DATABASE_URL must start with postgres:// or postgresql://",
    ),

  // Writer (Gemini) + critic (Groq). Required at boot so a campaign never
  // queues and then dies mid-run on a missing key.
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  GROQ_API_KEY: z.string().min(1),

  // Model ids are configured via env, never hard-coded in source.
  WRITER_MODEL: z.string().min(1),
  CRITIC_MODEL: z.string().min(1),

  // Bluesky publishing (tools/social/bluesky.ts). Optional until you publish.
  BLUESKY_HANDLE: z.string().optional(),
  BLUESKY_APP_PASSWORD: z.string().optional(),
});

function loadEnv() {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return process.env as unknown as z.infer<typeof envSchema>;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
