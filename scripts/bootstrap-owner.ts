import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { client } from "@/db/client";
import {
  addWorkspaceMember,
  getMembershipByUserId,
  getWorkspaceBySlug,
  LOCAL_WORKSPACE_SLUG,
} from "@/db/queries/workspaces";

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  if (!email || !password) {
    throw new Error(
      "Usage: node --import ./scripts/load-env.mjs --import tsx scripts/bootstrap-owner.ts --email=you@example.com --password=...",
    );
  }

  const workspace = await getWorkspaceBySlug(LOCAL_WORKSPACE_SLUG);
  if (!workspace) {
    throw new Error(
      `Workspace slug "${LOCAL_WORKSPACE_SLUG}" is missing. Apply migration 0004 first.`,
    );
  }

  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const listed = await admin.auth.admin.listUsers({ perPage: 1000 });
    const match = listed.data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (!match) {
      throw new Error(
        created.error?.message ?? `Could not create or find user ${email}`,
      );
    }
    userId = match.id;
  }

  const existing = await getMembershipByUserId(userId);
  if (existing) {
    console.log(
      `User already in workspace ${existing.workspace.slug} as ${existing.role}`,
    );
    return;
  }

  await addWorkspaceMember({
    workspaceId: workspace.id,
    userId,
    role: "owner",
  });
  console.log(`Owner ${email} attached to workspace ${workspace.slug}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
