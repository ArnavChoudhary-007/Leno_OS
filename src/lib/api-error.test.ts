import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apiErrorMessage } from "./api-error";

describe("apiErrorMessage", () => {
  it("reads the nested Phase 1 error shape", () => {
    assert.equal(
      apiErrorMessage(
        { error: { code: "unauthorized", message: "Sign in to continue." } },
        "fallback",
      ),
      "Sign in to continue.",
    );
  });

  it("still reads a legacy string error", () => {
    assert.equal(
      apiErrorMessage({ error: "Campaign is still running" }, "fallback"),
      "Campaign is still running",
    );
  });

  it("uses the fallback when the body is empty", () => {
    assert.equal(apiErrorMessage({}, "fallback"), "fallback");
  });
});
