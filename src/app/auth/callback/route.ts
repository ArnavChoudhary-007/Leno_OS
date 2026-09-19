import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/auth/server";
import { env } from "@/env";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/";
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (code) {
    const supabase = await createSupabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const base = env.APP_URL || origin;
  return NextResponse.redirect(new URL(next, base));
}
