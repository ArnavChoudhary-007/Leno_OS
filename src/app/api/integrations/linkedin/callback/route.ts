import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuthContext, requireCan } from "@/auth/server";
import { isPublicDemo } from "@/auth/public-demo";
import { AppError } from "@/shared/errors";
import { completeLinkedInOAuth } from "@/tools/social/linkedin";

export const runtime = "nodejs";

const STATE_COOKIE = "li_oauth_state";

function timingEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const integrations = new URL("/integrations", url.origin);

  try {
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");
    if (isPublicDemo()) {
      throw new AppError(
        "forbidden",
        "Connecting accounts is turned off in this public demo.",
      );
    }

    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      integrations.searchParams.set("linkedin_error", "denied");
      return NextResponse.redirect(integrations);
    }

    const code = url.searchParams.get("code")?.trim();
    const state = url.searchParams.get("state")?.trim();
    const jar = await cookies();
    const cookie = jar.get(STATE_COOKIE)?.value;
    jar.delete(STATE_COOKIE);

    if (!code || !state || !cookie) {
      integrations.searchParams.set("linkedin_error", "state");
      return NextResponse.redirect(integrations);
    }

    const dot = cookie.indexOf(".");
    const nonce = dot >= 0 ? cookie.slice(0, dot) : "";
    const workspaceId = dot >= 0 ? cookie.slice(dot + 1) : "";
    if (!timingEqual(nonce, state) || workspaceId !== ctx.workspaceId) {
      integrations.searchParams.set("linkedin_error", "state");
      return NextResponse.redirect(integrations);
    }

    await completeLinkedInOAuth(ctx.workspaceId, code);
    integrations.searchParams.set("linkedin", "connected");
    return NextResponse.redirect(integrations);
  } catch (err) {
    if (err instanceof AppError && err.code === "unauthorized") {
      return NextResponse.redirect(new URL("/sign-in?next=/integrations", request.url));
    }
    console.error("[linkedin] oauth callback:", err instanceof Error ? err.message : err);
    integrations.searchParams.set("linkedin_error", "token");
    return NextResponse.redirect(integrations);
  }
}
