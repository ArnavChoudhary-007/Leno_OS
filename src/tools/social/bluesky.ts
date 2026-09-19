import { AtpAgent, RichText } from "@atproto/api";
import { env } from "@/env";
import { blueskyPostUrl } from "./bluesky-url";

export { blueskyPostUrl } from "./bluesky-url";

export interface PublishResult {
  url: string;
  uri: string;
  cid: string;
}

const BLUESKY_SERVICE = "https://bsky.social";
/** Bluesky's hard text limit (graphemes ≈ chars for our ASCII-heavy posts). */
export const BLUESKY_MAX_GRAPHEMES = 300;

export function blueskyConfigured(): boolean {
  return Boolean(env.BLUESKY_HANDLE?.trim() && env.BLUESKY_APP_PASSWORD?.trim());
}

/**
 * Publishes one approved draft to Bluesky. Plain deterministic code —
 * agents must never call this. Only an approval/publish API may.
 */
export async function publish(
  text: string,
  image?: { bytes: Uint8Array; mime: string; alt?: string },
): Promise<PublishResult> {
  const handle = env.BLUESKY_HANDLE?.trim();
  const password = env.BLUESKY_APP_PASSWORD?.trim();

  if (!handle || !password) {
    throw new Error(
      "Bluesky is not configured — set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env",
    );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Cannot publish an empty post");
  }
  if ([...trimmed].length > BLUESKY_MAX_GRAPHEMES) {
    throw new Error(
      `Post is ${[...trimmed].length} characters; Bluesky allows ${BLUESKY_MAX_GRAPHEMES}`,
    );
  }

  const agent = new AtpAgent({ service: BLUESKY_SERVICE });
  await agent.login({ identifier: handle, password });

  const richText = new RichText({ text: trimmed });
  await richText.detectFacets(agent);

  let embed: { $type: "app.bsky.embed.images"; images: { alt: string; image: unknown }[] } | undefined;
  if (image && image.bytes.byteLength > 0) {
    const uploaded = await agent.uploadBlob(image.bytes, { encoding: image.mime });
    embed = {
      $type: "app.bsky.embed.images",
      images: [
        {
          alt: image.alt?.trim() || "Campaign image",
          image: uploaded.data.blob,
        },
      ],
    };
  }

  const result = await agent.post({
    text: richText.text,
    facets: richText.facets,
    createdAt: new Date().toISOString(),
    ...(embed ? { embed } : {}),
  });

  return {
    uri: result.uri,
    cid: result.cid,
    url: blueskyPostUrl(result.uri, handle),
  };
}
