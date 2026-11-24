import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSameOrigin, ipFromHeaders } from "./http";
import { env } from "@/env";

describe("ipFromHeaders", () => {
  it("uses the first x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": " 203.0.113.9, 10.0.0.1 " });
    assert.equal(ipFromHeaders(h), "203.0.113.9");
  });

  it("falls back to x-real-ip, then local", () => {
    assert.equal(ipFromHeaders(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
    assert.equal(ipFromHeaders(new Headers()), "local");
  });
});

describe("same-origin mutation protection", () => {
  it("accepts only the configured origin, not an arbitrary localhost origin", () => {
    const previous = env.APP_URL;
    try {
      env.APP_URL = "https://app.example.com";
      assert.doesNotThrow(() => assertSameOrigin(new Request("https://app.example.com/api/campaigns", { headers: { origin: "https://app.example.com" } })));
      for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "https://attacker.example", "null"]) {
        assert.throws(() => assertSameOrigin(new Request("https://app.example.com/api/campaigns", { headers: { origin } })), { code: "forbidden" });
      }
    } finally {
      if (previous === undefined) delete process.env.APP_URL;
      else env.APP_URL = previous;
    }
  });
});
