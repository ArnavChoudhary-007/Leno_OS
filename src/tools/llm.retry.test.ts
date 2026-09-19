import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRetryable } from "./llm";

describe("isRetryable", () => {
  it("retries on HTTP 429 and 5xx", () => {
    assert.equal(isRetryable({ statusCode: 429 }), true);
    assert.equal(isRetryable({ statusCode: 503 }), true);
    assert.equal(isRetryable({ statusCode: 400 }), false);
  });

  it("retries on quota / rate-limit messages", () => {
    assert.equal(
      isRetryable(new Error("You exceeded your current quota")),
      true,
    );
    assert.equal(isRetryable(new Error("rate limit exceeded")), true);
  });

  it("retries on retired model messages", () => {
    assert.equal(
      isRetryable(new Error("This model is no longer available to new users")),
      true,
    );
  });
});
