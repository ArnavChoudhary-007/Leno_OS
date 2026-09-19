import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  linkedinAuthorizeUrl,
  linkedinPostUrl,
  linkedinRedirectUri,
} from "./linkedin-url";

describe("linkedinRedirectUri", () => {
  it("points at the OAuth callback under APP_URL", () => {
    assert.equal(
      linkedinRedirectUri("http://localhost:3000"),
      "http://localhost:3000/api/integrations/linkedin/callback",
    );
  });
});

describe("linkedinAuthorizeUrl", () => {
  it("asks for OpenID plus w_member_social", () => {
    const url = linkedinAuthorizeUrl({
      clientId: "abc",
      redirectUri: "http://localhost:3000/api/integrations/linkedin/callback",
      state: "nonce-1",
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://www.linkedin.com");
    assert.equal(parsed.searchParams.get("client_id"), "abc");
    assert.equal(parsed.searchParams.get("state"), "nonce-1");
    assert.match(parsed.searchParams.get("scope") ?? "", /w_member_social/);
    assert.match(parsed.searchParams.get("scope") ?? "", /openid/);
  });
});

describe("linkedinPostUrl", () => {
  it("encodes the URN for a feed permalink", () => {
    assert.equal(
      linkedinPostUrl("urn:li:ugcPost:123"),
      "https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A123",
    );
  });
});
