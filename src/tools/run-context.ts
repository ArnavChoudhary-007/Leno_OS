import { AsyncLocalStorage } from "node:async_hooks";
import type { CampaignOptions } from "@/shared/types";

type ModelContext = {
  signal: AbortSignal;
  options: CampaignOptions;
  attempts: number;
  maxAttempts: number;
  onAttempt: () => Promise<void>;
};

const modelContext = new AsyncLocalStorage<ModelContext>();

export function withModelContext<Result>(context: Omit<ModelContext, "attempts">, task: () => Promise<Result>): Promise<Result> {
  return modelContext.run({ ...context, attempts: 0 }, task);
}

export function getModelContext() {
  return modelContext.getStore();
}

export function runSignal(timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  const context = getModelContext();
  return context ? AbortSignal.any([context.signal, timeout]) : timeout;
}

export async function recordModelAttempt(): Promise<void> {
  const context = getModelContext();
  if (!context) return;
  context.signal.throwIfAborted();
  if (context.attempts >= context.maxAttempts) throw new Error("Model attempt budget exhausted");
  context.attempts += 1;
  await context.onAttempt();
}
