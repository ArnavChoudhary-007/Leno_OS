import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/env";
import { getMembershipByUserId } from "@/db/queries/workspaces";
import { AppError } from "@/shared/errors";
import { can, type AuthzAction } from "@/authz/can";
import type { AuthContext } from "@/authz/context";

export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; proxy handles the refresh.
        }
      },
    },
  });
}

export async function getSessionUser(): Promise<{
  id: string;
  email: string | null;
} | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const user = await getSessionUser();
  if (!user) throw new AppError("unauthorized");

  const membership = await getMembershipByUserId(user.id);
  if (!membership) throw new AppError("no_workspace");

  return {
    userId: user.id,
    email: user.email,
    workspaceId: membership.workspace_id,
    role: membership.role,
  };
}

export function requireCan(ctx: AuthContext, action: AuthzAction): void {
  if (!can(ctx.role, action)) throw new AppError("forbidden");
}

/** For RSC pages: redirect to sign-in, or throw no_workspace for the page to render. */
export async function requirePageAuth(): Promise<AuthContext> {
  try {
    return await requireAuthContext();
  } catch (err) {
    if (err instanceof AppError && err.code === "unauthorized") {
      redirect("/sign-in");
    }
    throw err;
  }
}

export async function loadPageAuth(): Promise<AuthContext | null> {
  try {
    return await requirePageAuth();
  } catch (err) {
    if (err instanceof AppError && err.code === "no_workspace") {
      return null;
    }
    throw err;
  }
}
