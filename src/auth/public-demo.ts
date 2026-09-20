/**
 * Public demo mode (PUBLIC_DEMO=1): no sign-in. Every visitor shares one
 * editor identity in the seeded `local` workspace, so judges can open the
 * URL and use the app straight away.
 *
 * Safety rails while it is on:
 * - Publishing is blocked, so visitors can't post to the owner's real
 *   Bluesky / LinkedIn accounts.
 * - Connecting or disconnecting LinkedIn is blocked.
 * - Per-user rate limits still apply, and because every visitor is the same
 *   user they cap total API spend (e.g. 10 campaigns per hour overall).
 *
 * Kept free of Node-only imports so the proxy (middleware) can use it.
 */
export const PUBLIC_DEMO_USER_ID = "public-demo";

export function isPublicDemo(): boolean {
  return process.env.PUBLIC_DEMO === "1";
}
