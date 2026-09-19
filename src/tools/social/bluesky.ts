export interface PublishResult {
  url: string;
}

/**
 * Publishes one approved draft to Bluesky.
 *
 * Not built yet. When it is: this is plain, deterministic code — an agent
 * must never call it. Only an approval flow may, and only for a draft a
 * human has marked approved. It will log in with AtpAgent from
 * @atproto/api using BLUESKY_HANDLE / BLUESKY_APP_PASSWORD.
 */
export async function publish(_text: string): Promise<PublishResult> {
  throw new Error("publish() is not implemented yet");
}
