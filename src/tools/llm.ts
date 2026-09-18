import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";
import { env } from "@/env";

function requireModelId(name: "WRITER_MODEL" | "CRITIC_MODEL"): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to .env.local (see .env.example) — model ids are configured via env, never hard-coded.`,
    );
  }
  return value;
}

/** Writer model (Gemini Flash via Google), id read from WRITER_MODEL. */
export function getWriterModel(): LanguageModel {
  return google(requireModelId("WRITER_MODEL"));
}

/** Critic model (Llama 3.3 70B via Groq), id read from CRITIC_MODEL. */
export function getCriticModel(): LanguageModel {
  return groq(requireModelId("CRITIC_MODEL"));
}

/**
 * Runs `primary`, falling back to `fallback` if it throws.
 * TODO: implement — add retry/backoff on the primary call before falling
 * back, and log which path was used to run_steps.
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
): Promise<T> {
  void primary;
  void fallback;
  throw new Error("withFallback() is not implemented yet");
}
