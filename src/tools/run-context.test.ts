import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { describe, it } from "node:test";
import { CampaignOptionsSchema } from "@/shared/schemas";
import { getModelContext, recordModelAttempt, runSignal, withModelContext } from "./run-context";

describe("model attempt budgets and cancellation", () => {
  it("counts every attempt and refuses retries after the hard ceiling", async () => {
    let counted = 0;
    await withModelContext({ options: CampaignOptionsSchema.parse({ research: false }), signal: new AbortController().signal,
      maxAttempts: 2, onAttempt: async () => { counted += 1; } }, async () => {
      await Promise.all([recordModelAttempt(), recordModelAttempt()]);
      await assert.rejects(recordModelAttempt(), /budget exhausted/);
      assert.equal(getModelContext()?.attempts, 2);
      assert.equal(getModelContext()?.options.research, false);
    });
    assert.equal(counted, 2);
    assert.equal(getModelContext(), undefined);
  });

  it("shares the run deadline with in-flight calls and subsequent attempts", async () => {
    const controller = new AbortController();
    let counted = 0;
    await withModelContext({ options: CampaignOptionsSchema.parse({}), signal: controller.signal, maxAttempts: 10,
      onAttempt: async () => { counted += 1; } }, async () => {
      const inflight = setTimeout(60_000, undefined, { signal: runSignal(60_000) });
      controller.abort();
      await assert.rejects(inflight, { name: "AbortError" });
      await assert.rejects(recordModelAttempt(), { name: "AbortError" });
    });
    assert.equal(counted, 0);
  });

  it("keeps parallel campaigns' controls, counters and signals isolated", async () => {
    const counts = [0, 0];
    await Promise.all([0, 1].map((index) => withModelContext({ options: CampaignOptionsSchema.parse({ creativity: index }),
      signal: new AbortController().signal, maxAttempts: index + 1, onAttempt: async () => { counts[index] += 1; } }, async () => {
      await setTimeout(1);
      await recordModelAttempt();
      assert.equal(getModelContext()?.options.creativity, index);
      assert.equal(getModelContext()?.attempts, 1);
      if (index === 1) await recordModelAttempt();
    })));
    assert.deepEqual(counts, [1, 2]);
  });
});
