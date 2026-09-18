/**
 * Validates process.env with zod at startup so a missing/malformed key
 * fails fast with a readable message instead of surfacing as a confusing
 * runtime error deep inside an agent or db call.
 *
 * Most keys are optional at this groundwork stage because no agent, LLM
 * call, or publish path is implemented yet. As each part comes online,
 * tighten its key here from `.optional()` to required.
 *
 * Set SKIP_ENV_VALIDATION=1 to bypass validation entirely — used by the
 * Docker build stage, which compiles the app before any secret is present.
 */
import { z } from "zod";

const envSchema = z.object({
  // Postgres, via postgres.js. Required — see docker-compose*.yml / .env.example.
  DATABASE_URL: z
    .string()
    .min(1)
    .regex(/^postgres:\/\//, "DATABASE_URL must start with postgres://"),

  // Vercel AI SDK providers. Required once agents/tools/llm.ts is used.
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Model ids are configured via env, never hard-coded in source.
  WRITER_MODEL: z.string().optional(),
  CRITIC_MODEL: z.string().optional(),

  // Bluesky publishing (tools/social/bluesky.ts), used later.
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
