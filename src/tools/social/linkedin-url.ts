export const LINKEDIN_SCOPES = [
  "openid",
  "profile",
  "email",
  "w_member_social",
] as const;

export function linkedinRedirectUri(appUrl: string): string {
  return new URL("/api/integrations/linkedin/callback", appUrl).toString();
}

export function linkedinAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  return url.toString();
}

/** Public permalink for a ugcPost or share URN. */
export function linkedinPostUrl(urn: string): string {
  const id = urn.trim();
  if (!id) throw new Error("LinkedIn post URN is empty");
  return `https://www.linkedin.com/feed/update/${encodeURIComponent(id)}`;
}
