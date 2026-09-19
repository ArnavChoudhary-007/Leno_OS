import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ipFromHeaders } from "./http";

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
