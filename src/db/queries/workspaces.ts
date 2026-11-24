import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workspaceInvites, workspaceMembers, workspaces } from "@/db/schema";
import type { WorkspaceRole } from "@/shared/types";
import { AppError } from "@/shared/errors";

export const LOCAL_WORKSPACE_SLUG = "local";

export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;

export async function getWorkspaceBySlug(
  slug: string,
): Promise<Workspace | null> {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getMembershipByUserId(
  userId: string,
): Promise<(WorkspaceMember & { workspace: Workspace }) | null> {
  const [row] = await db
    .select()
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspace_id, workspaces.id))
    .where(eq(workspaceMembers.user_id, userId))
    .limit(1);
  if (!row) return null;
  return { ...row.workspace_members, workspace: row.workspaces };
}

export async function addWorkspaceMember(input: {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}): Promise<WorkspaceMember> {
  const [row] = await db
    .insert(workspaceMembers)
    .values({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      role: input.role,
    })
    .returning();
  return row;
}

export async function setWorkspaceMemberRole(
  userId: string,
  role: WorkspaceRole,
): Promise<WorkspaceMember | null> {
  const [row] = await db
    .update(workspaceMembers)
    .set({ role })
    .where(eq(workspaceMembers.user_id, userId))
    .returning();
  return row ?? null;
}

export async function insertInvite(input: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: string;
}): Promise<WorkspaceInvite> {
  const [row] = await db
    .insert(workspaceInvites)
    .values({
      workspace_id: input.workspaceId,
      email: input.email,
      role: input.role,
      token_hash: input.tokenHash,
      invited_by: input.invitedBy,
      expires_at: input.expiresAt,
    })
    .returning();
  return row;
}

export async function acceptWorkspaceInvite(tokenHash: string, userId: string, email: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const [invite] = await tx.select().from(workspaceInvites).where(eq(workspaceInvites.token_hash, tokenHash)).for("update");
    if (!invite || invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new AppError("invalid_body", "This invite is expired, invalid, or already used.");
    }
    if (!email || email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new AppError("forbidden", "Sign in with the email this invite was sent to.");
    }
    const [existing] = await tx.select().from(workspaceMembers).where(eq(workspaceMembers.user_id, userId)).limit(1);
    if (existing) throw new AppError("conflict", "You already belong to a workspace.");
    await tx.insert(workspaceMembers).values({ workspace_id: invite.workspace_id, user_id: userId, role: invite.role === "owner" ? "admin" : invite.role });
    await tx.update(workspaceInvites).set({ accepted_at: new Date().toISOString() }).where(eq(workspaceInvites.id, invite.id));
  });
}
