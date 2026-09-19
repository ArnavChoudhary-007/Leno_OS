import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError, ERROR_MESSAGES, toAppError } from "./errors";

describe("toAppError", () => {
  it("passes AppError through", () => {
    const err = new AppError("not_found", "Campaign not found");
    assert.equal(toAppError(err), err);
    assert.equal(err.status, 404);
  });

  it("does not leak provider or SQL messages to the client", () => {
    const leaked = toAppError(
      new Error("password authentication failed for user postgres"),
    );
    assert.equal(leaked.code, "job_failed");
    assert.equal(leaked.message, ERROR_MESSAGES.job_failed);
    assert.equal(leaked.message.includes("postgres"), false);
  });
});
