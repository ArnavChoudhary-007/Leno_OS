/**
 * Fails fast on bad config instead of surfacing deep inside an agent or db
 * call. SKIP_ENV_VALIDATION=1 bypasses it for the Docker build, which
 * compiles before any secret exists.
 *
 * Do not import this module from a Client Component. Service-role and
 * DATABASE_URL must never ship to the browser.
 */
import { z } from "zod";

function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

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

  // GPT Image 1.5 for campaign photos when the user did not upload one.
  // Optional at boot so CI/Docker still compile; generation no-ops without them.
  // Empty strings from a copied .env.example are treated as unset.
  OPENAI_API_KEY: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  IMAGE_MODEL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  // OpenAI's square size. 1023×1024 is not a valid size — we cap at 1024×1024.
  IMAGE_SIZE: z.preprocess(
    (value) => (value === "" || value === undefined ? "1024x1024" : value),
    z.literal("1024x1024"),
  ),

  // Bluesky publishing (tools/social/bluesky.ts). Optional until you publish.
  BLUESKY_HANDLE: z.string().optional(),
  BLUESKY_APP_PASSWORD: z.string().optional(),

  // Tavily — live web research for LinkedIn drafts. Optional; skipped if unset.
  TAVILY_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // LinkedIn OAuth (Share on LinkedIn + Sign In with OpenID). Optional until
  // a workspace connects an account. Redirect: ${APP_URL}/api/integrations/linkedin/callback
  LINKEDIN_CLIENT_ID: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
  LINKEDIN_CLIENT_SECRET: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ),
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
