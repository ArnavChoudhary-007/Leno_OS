import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { generateObject, type LanguageModel } from "ai";
import type { z } from "zod";
import { env } from "@/env";

export type LlmRole = "writer" | "critic";

const TIMEOUT_MS = 30_000;

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

/** Writer = Gemini via Google, critic = Llama via Groq. Deliberately different families. */
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

/**
 * Worth a second try on the other provider: rate limits, provider-side
 * failures and timeouts. 404/not-found counts too — a bad or retired model
 * id in env shouldn't take the whole campaign down when the other provider
 * can answer.
 */
function isRetryable(err: unknown): boolean {
  const name = nameOf(err);
  if (name === "TimeoutError" || name === "AbortError") return true;
  if (name === "NoSuchModelError") return true;

  const status = statusOf(err);
  if (status === 429 || status === 404) return true;
  if (typeof status === "number" && status >= 500) return true;

  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("is not supported")
  );
}

export type StructuredResult<T> = {
  object: T;
  /** The model id that actually answered — may be the fallback. */
  model: string;
  ms: number;
};

/**
 * One structured LLM call, validated against a zod schema by the AI SDK.
 * Times out at 30s and retries once on the *other* provider's model, so a
 * Google outage falls through to Groq and vice versa.
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
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { object: object as T, model: target.id, ms: Date.now() - started };
  };

  try {
    return await call(primary);
  } catch (err) {
    if (!isRetryable(err)) throw err;

    const fallback = modelFor(role === "writer" ? "critic" : "writer");
    console.warn(
      `[llm] ${role} model "${primary.id}" failed (${err instanceof Error ? err.message : String(err)}); retrying on "${fallback.id}"`,
    );
    return await call(fallback);
  }
}
