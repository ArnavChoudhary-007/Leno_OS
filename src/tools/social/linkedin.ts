import { z } from "zod";
import { env } from "@/env";
import {
  deletePlatformConnection,
  getPlatformConnection,
  upsertPlatformConnection,
} from "@/db/queries/connections";
import { AppError } from "@/shared/errors";
import {
  linkedinAuthorizeUrl,
  linkedinPostUrl,
  linkedinRedirectUri,
} from "./linkedin-url";

export {
  LINKEDIN_SCOPES,
  linkedinAuthorizeUrl,
  linkedinPostUrl,
  linkedinRedirectUri,
} from "./linkedin-url";

const TIMEOUT_MS = 30_000;
const TOKEN_SKEW_MS = 5 * 60 * 1000;

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
});

const UserinfoSchema = z.object({
  sub: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
});

const MeSchema = z.object({
  id: z.string().min(1),
  localizedFirstName: z.string().optional(),
  localizedLastName: z.string().optional(),
});

const RegisterUploadSchema = z.object({
  value: z.object({
    asset: z.string().min(1),
    uploadMechanism: z.object({
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": z.object({
        uploadUrl: z.string().min(1),
      }),
    }),
  }),
});

const UgcPostSchema = z.object({
  id: z.string().min(1),
});

export interface LinkedInPublishResult {
  url: string;
  urn: string;
}

export function linkedinConfigured(): boolean {
  return Boolean(
    env.LINKEDIN_CLIENT_ID?.trim() && env.LINKEDIN_CLIENT_SECRET?.trim(),
  );
}

export async function linkedinConnected(workspaceId: string): Promise<boolean> {
  const row = await getPlatformConnection(workspaceId, "linkedin");
  return Boolean(row);
}

export async function linkedinAccountName(
  workspaceId: string,
): Promise<string | null> {
  const row = await getPlatformConnection(workspaceId, "linkedin");
  return row?.account_name ?? null;
}

export function linkedinAppRedirectUri(): string {
  return linkedinRedirectUri(env.APP_URL);
}

export function startLinkedInAuthorizeUrl(state: string): string {
  const clientId = env.LINKEDIN_CLIENT_ID?.trim();
  if (!clientId) {
    throw new AppError("not_configured", "LinkedIn OAuth is not configured.");
  }
  return linkedinAuthorizeUrl({
    clientId,
    redirectUri: linkedinAppRedirectUri(),
    state,
  });
}

export async function completeLinkedInOAuth(
  workspaceId: string,
  code: string,
): Promise<{ account_name: string }> {
  const tokens = await exchangeCode(code);
  const profile = await fetchProfile(tokens.access_token);
  await upsertPlatformConnection({
    workspace_id: workspaceId,
    platform: "linkedin",
    account_name: profile.name,
    account_urn: profile.urn,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: tokens.expires_at,
    scopes: tokens.scope,
  });
  return { account_name: profile.name };
}

export async function disconnectLinkedIn(workspaceId: string): Promise<void> {
  await deletePlatformConnection(workspaceId, "linkedin");
}

/**
 * Publishes one approved draft to the connected LinkedIn member. Plain
 * deterministic code — agents must never call this.
 */
export async function publish(
  workspaceId: string,
  text: string,
  image?: { bytes: Uint8Array; mime: string; alt?: string },
): Promise<LinkedInPublishResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError("not_publishable", "Cannot publish an empty post");
  }
  if (trimmed.length > 3000) {
    throw new AppError(
      "not_publishable",
      `Post is ${trimmed.length} characters; LinkedIn allows 3000`,
    );
  }

  const { token, urn } = await getValidAccess(workspaceId);

  let assetUrn: string | undefined;
  if (image && image.bytes.byteLength > 0) {
    assetUrn = await uploadImage(token, urn, image);
  }

  const body = assetUrn
    ? ugcImageBody(urn, trimmed, assetUrn, image?.alt)
    : ugcTextBody(urn, trimmed);

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error(`[linkedin] publish failed (${res.status}): ${raw.slice(0, 400)}`);
    throw new AppError(
      "job_failed",
      "LinkedIn rejected the post. Reconnect the account or check Share on LinkedIn permissions.",
    );
  }

  const parsed = UgcPostSchema.parse(await res.json());
  return { urn: parsed.id, url: linkedinPostUrl(parsed.id) };
}

async function exchangeCode(code: string) {
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: linkedinAppRedirectUri(),
  });
}

async function requestToken(params: Record<string, string>) {
  const clientId = env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = env.LINKEDIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new AppError("not_configured", "LinkedIn OAuth is not configured.");
  }

  const body = new URLSearchParams({
    ...params,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    console.error(`[linkedin] token exchange failed (${res.status}): ${raw.slice(0, 200)}`);
    throw new AppError(
      "job_failed",
      "LinkedIn did not issue an access token. Try connecting again.",
    );
  }

  const parsed = TokenResponseSchema.parse(await res.json());
  return {
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token,
    expires_at: new Date(Date.now() + parsed.expires_in * 1000).toISOString(),
    scope: parsed.scope ?? "",
  };
}

async function fetchProfile(accessToken: string): Promise<{
  urn: string;
  name: string;
}> {
  const userinfo = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (userinfo.ok) {
    const parsed = UserinfoSchema.parse(await userinfo.json());
    const name =
      parsed.name?.trim() ||
      [parsed.given_name, parsed.family_name].filter(Boolean).join(" ").trim() ||
      parsed.email?.trim() ||
      parsed.sub;
    return { urn: `urn:li:person:${parsed.sub}`, name };
  }

  const me = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!me.ok) {
    const raw = await me.text().catch(() => "");
    console.error(`[linkedin] profile failed (${me.status}): ${raw.slice(0, 200)}`);
    throw new AppError(
      "job_failed",
      "LinkedIn did not return a profile. Enable Sign In with LinkedIn (OpenID).",
    );
  }
  const parsed = MeSchema.parse(await me.json());
  const name =
    [parsed.localizedFirstName, parsed.localizedLastName]
      .filter(Boolean)
      .join(" ")
      .trim() || parsed.id;
  return { urn: `urn:li:person:${parsed.id}`, name };
}

async function getValidAccess(workspaceId: string): Promise<{
  token: string;
  urn: string;
}> {
  const row = await getPlatformConnection(workspaceId, "linkedin");
  if (!row) {
    throw new AppError(
      "not_configured",
      "Connect LinkedIn on Integrations before publishing.",
    );
  }

  const expiringSoon =
    new Date(row.expires_at).getTime() - Date.now() <= TOKEN_SKEW_MS;

  if (!expiringSoon) {
    return { token: row.access_token, urn: row.account_urn };
  }

  if (!row.refresh_token) {
    throw new AppError(
      "not_configured",
      "LinkedIn access expired. Reconnect the account on Integrations.",
    );
  }

  try {
    const tokens = await requestToken({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    });
    await upsertPlatformConnection({
      workspace_id: workspaceId,
      platform: "linkedin",
      account_name: row.account_name,
      account_urn: row.account_urn,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? row.refresh_token,
      expires_at: tokens.expires_at,
      scopes: tokens.scope || row.scopes,
    });
    return { token: tokens.access_token, urn: row.account_urn };
  } catch (err) {
    if (err instanceof AppError) {
      throw new AppError(
        "not_configured",
        "LinkedIn access expired. Reconnect the account on Integrations.",
      );
    }
    throw err;
  }
}

async function uploadImage(
  token: string,
  ownerUrn: string,
  image: { bytes: Uint8Array; mime: string },
): Promise<string> {
  const registered = await fetch(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: ownerUrn,
          serviceRelationships: [
            {
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );

  if (!registered.ok) {
    const raw = await registered.text().catch(() => "");
    console.error(
      `[linkedin] register upload failed (${registered.status}): ${raw.slice(0, 200)}`,
    );
    throw new AppError("job_failed", "LinkedIn could not accept the image upload.");
  }

  const parsed = RegisterUploadSchema.parse(await registered.json());
  const uploadUrl =
    parsed.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl;

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": image.mime || "image/jpeg",
    },
    body: Buffer.from(image.bytes),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!put.ok) {
    const raw = await put.text().catch(() => "");
    console.error(`[linkedin] image PUT failed (${put.status}): ${raw.slice(0, 200)}`);
    throw new AppError("job_failed", "LinkedIn could not receive the image.");
  }

  return parsed.value.asset;
}

function ugcTextBody(author: string, text: string) {
  return {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
}

function ugcImageBody(
  author: string,
  text: string,
  assetUrn: string,
  alt?: string,
) {
  return {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "IMAGE",
        media: [
          {
            status: "READY",
            description: { text: alt?.trim() || "Campaign image" },
            media: assetUrn,
            title: { text: "Campaign image" },
          },
        ],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
}
