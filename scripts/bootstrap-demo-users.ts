/**
 * Creates local demo logins in the `local` workspace (one of each role).
 *
 *   npm run bootstrap-demo-users
 *
 * Override the shared password with DEMO_PASSWORD. Refuses in production
 * unless ALLOW_DEMO_SEED=1.
 *
 * Uses the GoTrue admin HTTP API directly so this works on Node 20
 * without the Realtime WebSocket that @supabase/supabase-js requires.
 */
import { env } from "@/env";
import { client } from "@/db/client";
import {
  addWorkspaceMember,
  getMembershipByUserId,
  getWorkspaceBySlug,
  LOCAL_WORKSPACE_SLUG,
  setWorkspaceMemberRole,
} from "@/db/queries/workspaces";
import type { WorkspaceRole } from "@/shared/types";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Loopwave-demo-1";

const DEMO_USERS: { email: string; role: WorkspaceRole }[] = [
  { email: "owner@example.com", role: "owner" },
  { email: "admin@example.com", role: "admin" },
  { email: "editor@example.com", role: "editor" },
  { email: "viewer@example.com", role: "viewer" },
];

type AuthUser = { id: string; email?: string | null };

type AuthError = Error & { status?: number };

function adminHeaders(): HeadersInit {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: { ...adminHeaders(), ...init?.headers },
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const msg =
      (typeof record.msg === "string" && record.msg) ||
      (typeof record.message === "string" && record.message) ||
      res.statusText;
    const err = new Error(msg) as AuthError;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const wanted = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const data = await adminJson<{ users: AuthUser[] }>(
      `/admin/users?page=${page}&per_page=200`,
    );
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(email: string, password: string): Promise<string> {
  try {
    const created = await adminJson<{ id: string; user?: AuthUser }>(
      "/admin/users",
      {
        method: "POST",
        body: JSON.stringify({ email, password, email_confirm: true }),
      },
    );
    return created.user?.id ?? created.id;
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err
      ? Number(err.status)
      : 0;
    if (status !== 422 && status !== 400) throw err;
  }

  const existing = await findUserByEmail(email);
  if (!existing) {
    throw new Error(`Could not create or find user ${email}`);
  }

  await adminJson(`/admin/users/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify({ password, email_confirm: true }),
  });
  return existing.id;
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_SEED !== "1"
  ) {
    throw new Error(
      "Refusing to create demo users in production (set ALLOW_DEMO_SEED=1 to override).",
    );
  }

  const workspace = await getWorkspaceBySlug(LOCAL_WORKSPACE_SLUG);
  if (!workspace) {
    throw new Error(
      `Workspace slug "${LOCAL_WORKSPACE_SLUG}" is missing. Apply migration 0004 first.`,
    );
  }

  for (const demo of DEMO_USERS) {
    const userId = await ensureUser(demo.email, DEMO_PASSWORD);
    const membership = await getMembershipByUserId(userId);

    if (!membership) {
      await addWorkspaceMember({
        workspaceId: workspace.id,
        userId,
        role: demo.role,
      });
      console.log(`created  ${demo.email}  ${demo.role}  ${workspace.slug}`);
      continue;
    }

    if (membership.workspace_id !== workspace.id) {
      console.log(
        `skipped  ${demo.email}  already in workspace ${membership.workspace.slug} as ${membership.role}`,
      );
      continue;
    }

    if (membership.role !== demo.role) {
      await setWorkspaceMemberRole(userId, demo.role);
      console.log(
        `updated  ${demo.email}  ${membership.role} → ${demo.role}  ${workspace.slug}`,
      );
      continue;
    }

    console.log(`exists   ${demo.email}  ${demo.role}  ${workspace.slug}`);
  }

  console.log("\nSign in at /sign-in");
  for (const demo of DEMO_USERS) {
    console.log(`  ${demo.email}  /  ${DEMO_PASSWORD}  (${demo.role})`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
