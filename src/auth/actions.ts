"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash } from "node:crypto";
import { createSupabaseServer, getSessionUser } from "@/auth/server";
import { isPublicDemo } from "@/auth/public-demo";
import {
  addWorkspaceMember,
  getInviteByTokenHash,
  getMembershipByUserId,
  markInviteAccepted,
} from "@/db/queries/workspaces";
import { AppError } from "@/shared/errors";
import { InviteAcceptSchema, SignInSchema } from "@/shared/schemas";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { ipFromHeaders } from "@/lib/http";

export type SignInState = {
  ok: boolean;
  message?: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email and password." };
  }

  try {
    const ip = ipFromHeaders(await headers());
    await consumeRateLimit(RATE_LIMITS.authIp(ip));
    await consumeRateLimit(RATE_LIMITS.authEmail(parsed.data.email));
  } catch {
    return { ok: false, message: "Too many attempts. Try again shortly." };
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, message: "Email or password is incorrect." };
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  if (isPublicDemo()) redirect("/");
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export type AcceptInviteState = {
  ok: boolean;
  message?: string;
};

export async function acceptInvite(
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const parsed = InviteAcceptSchema.safeParse({ token: formData.get("token") });
  if (!parsed.success) {
    return { ok: false, message: "This invite link is invalid." };
  }

  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Sign in first, then open the invite link again." };
  }

  const existing = await getMembershipByUserId(user.id);
  if (existing) {
    return { ok: false, message: "You already belong to a workspace." };
  }

  const invite = await getInviteByTokenHash(hashToken(parsed.data.token));
  if (!invite || invite.accepted_at) {
    return { ok: false, message: "This invite link is invalid or already used." };
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return { ok: false, message: "This invite has expired." };
  }
  if (
    user.email &&
    invite.email.toLowerCase() !== user.email.toLowerCase()
  ) {
    return { ok: false, message: "Sign in with the email this invite was sent to." };
  }

  try {
    await addWorkspaceMember({
      workspaceId: invite.workspace_id,
      userId: user.id,
      role: invite.role === "owner" ? "admin" : invite.role,
    });
    await markInviteAccepted(invite.id);
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: "Could not accept this invite." };
  }

  redirect("/");
}
