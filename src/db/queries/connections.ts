import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformConnections } from "@/db/schema";

export type PlatformConnection = typeof platformConnections.$inferSelect;

export type UpsertPlatformConnection = {
  workspace_id: string;
  platform: string;
  account_name: string;
  account_urn: string;
  access_token: string;
  refresh_token?: string | null;
  expires_at: string;
  scopes: string;
};

export async function getPlatformConnection(
  workspaceId: string,
  platform: string,
): Promise<PlatformConnection | null> {
  const [row] = await db
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspace_id, workspaceId),
        eq(platformConnections.platform, platform),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function upsertPlatformConnection(
  input: UpsertPlatformConnection,
): Promise<PlatformConnection> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(platformConnections)
    .values({
      ...input,
      refresh_token: input.refresh_token ?? null,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [
        platformConnections.workspace_id,
        platformConnections.platform,
      ],
      set: {
        account_name: input.account_name,
        account_urn: input.account_urn,
        access_token: input.access_token,
        refresh_token: input.refresh_token ?? null,
        expires_at: input.expires_at,
        scopes: input.scopes,
        updated_at: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to save platform connection");
  return row;
}

export async function deletePlatformConnection(
  workspaceId: string,
  platform: string,
): Promise<void> {
  await db
    .delete(platformConnections)
    .where(
      and(
        eq(platformConnections.workspace_id, workspaceId),
        eq(platformConnections.platform, platform),
      ),
    );
}
