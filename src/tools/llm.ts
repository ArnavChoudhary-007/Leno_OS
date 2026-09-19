import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateObject, type LanguageModel } from "ai";
import type { z } from "zod";
import { env } from "@/env";

export type LlmRole = "writer" | "critic";

const TIMEOUT_MS = 30_000;
/** Retries on the primary provider before crossing to the other family. */
const PRIMARY_ATTEMPTS = 2;

/** Writer runs warm so drafts have some life; the critic runs cold. */
const TEMPERATURE: Record<LlmRole, number> = { writer: 0.8, critic: 0.2 };

function requireModelId(name: "WRITER_MODEL" | "CRITIC_MODEL"): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env (see .env.example) — model ids are configured via env, never hard-coded.`,
    );
  }
  return value;
}

function modelIdFor(role: LlmRole): string {
  return requireModelId(role === "writer" ? "WRITER_MODEL" : "CRITIC_MODEL");
}

/** Writer = Gemini via Google, critic = Groq. Deliberately different families. */
function modelFor(role: LlmRole): { id: string; model: LanguageModel } {
  const id = modelIdFor(role);
  return { id, model: role === "writer" ? google(id) : groq(id) };
}

function statusOf(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { statusCode?: number; status?: number; cause?: unknown };
  if (typeof e.statusCode === "number") return e.statusCode;
  if (typeof e.status === "number") return e.status;
  return e.cause ? statusOf(e.cause) : undefined;
}

function nameOf(err: unknown): string {
  if (!err || typeof err !== "object") return "";
  const e = err as { name?: string };
  return typeof e.name === "string" ? e.name : "";
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message.toLowerCase();
  return String(err).toLowerCase();
}

/**
 * Worth another try: rate limits, quotas, provider failures, timeouts,
 * and bad/retired model ids (fall through to the other provider).
 */
export function isRetryable(err: unknown): boolean {
  const name = nameOf(err);
  if (name === "TimeoutError" || name === "AbortError") return true;
  if (name === "NoSuchModelError" || name === "AI_APICallError") return true;

  const status = statusOf(err);
  if (status === 429 || status === 404 || status === 408) return true;
  if (typeof status === "number" && status >= 500) return true;

  const message = messageOf(err);
  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("is not supported") ||
    message.includes("no longer available") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("timeout") ||
    message.includes("overloaded") ||
    message.includes("unavailable")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type StructuredResult<T> = {
  object: T;
  /** The model id that actually answered — may be the fallback. */
  model: string;
  ms: number;
};

/**
 * One structured LLM call, validated against a zod schema by the AI SDK.
 * Retries the primary provider briefly, then falls through once to the
 * other family (writer ↔ critic) so a Google outage doesn't kill the run.
 */
export async function generateStructured<T>({
  role,
  schema,
  system,
  prompt,
  temperature,
}: {
  role: LlmRole;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
  temperature?: number;
}): Promise<StructuredResult<T>> {
  const primary = modelFor(role);
  const started = Date.now();

  const call = async (target: { id: string; model: LanguageModel }) => {
    const { object } = await generateObject({
      model: target.model,
      schema,
      system,
      prompt,
      temperature: temperature ?? TEMPERATURE[role],
      // Critic scores 4 platforms in one JSON blob; the Groq default
      // truncates mid-object and fails schema validation.
      maxOutputTokens: role === "critic" ? 8192 : 4096,
      // We own retries below — the SDK's default 2 retries burn free-tier quota.
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { object: object as T, model: target.id, ms: Date.now() - started };
  };

  let lastError: unknown;
  for (let attempt = 1; attempt <= PRIMARY_ATTEMPTS; attempt++) {
    try {
      return await call(primary);
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === PRIMARY_ATTEMPTS) break;
      const waitMs = 400 * attempt;
      console.warn(
        `[llm] ${role} "${primary.id}" attempt ${attempt} failed; retrying in ${waitMs}ms`,
      );
      await sleep(waitMs);
    }
  }

  if (!isRetryable(lastError)) throw lastError;

  const fallback = modelFor(role === "writer" ? "critic" : "writer");
  console.warn(
    `[llm] ${role} model "${primary.id}" failed (${lastError instanceof Error ? lastError.message : String(lastError)}); falling back to "${fallback.id}"`,
  );
  return await call(fallback);
}
