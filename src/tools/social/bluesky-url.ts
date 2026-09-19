/**
 * Turns an at:// URI into a bsky.app URL using the logged-in handle.
 * at://did:plc:…/app.bsky.feed.post/{rkey} → https://bsky.app/profile/{handle}/post/{rkey}
 */
export function blueskyPostUrl(uri: string, handle: string): string {
  const rkey = uri.split("/").pop();
  if (!rkey) {
    throw new Error(`Could not parse Bluesky post URI: ${uri}`);
  }
  const cleanHandle = handle.replace(/^@/, "");
  return `https://bsky.app/profile/${cleanHandle}/post/${rkey}`;
}
