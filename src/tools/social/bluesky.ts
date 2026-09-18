import { AtpAgent } from "@atproto/api";
import { env } from "@/env";

export interface PublishResult {
  url: string;
}

/**
 * Publishes one approved draft to Bluesky. This is plain, deterministic
 * code — never called by an agent directly, only by the workflow after a
 * human has approved the draft (see workflows/campaign-run.ts).
 *
 * TODO: implement — log in with AtpAgent using BLUESKY_HANDLE /
 * BLUESKY_APP_PASSWORD, post the record, and return its resulting url.
 */
export async function publish(text: string): Promise<PublishResult> {
  void text;
  void env.BLUESKY_HANDLE;
  void env.BLUESKY_APP_PASSWORD;
  void AtpAgent;
  throw new Error("publish() is not implemented yet");
}
