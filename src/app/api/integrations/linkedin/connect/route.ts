import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuthContext, requireCan } from "@/auth/server";
import { catchRouteError, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";
import { env } from "@/env";
import {
  linkedinConfigured,
  startLinkedInAuthorizeUrl,
} from "@/tools/social/linkedin";

export const runtime = "nodejs";

const STATE_COOKIE = "li_oauth_state";
const STATE_MAX_AGE = 10 * 60;

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");

    if (!linkedinConfigured()) {
      throw new AppError(
        "not_configured",
        "Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET, then retry.",
      );
    }

    const nonce = crypto.randomUUID();
    const jar = await cookies();
    jar.set(STATE_COOKIE, `${nonce}.${ctx.workspaceId}`, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: STATE_MAX_AGE,
      secure: env.APP_URL.startsWith("https://"),
    });

    return NextResponse.redirect(startLinkedInAuthorizeUrl(nonce));
  } catch (err) {
    if (err instanceof AppError && err.code === "not_configured") {
      return NextResponse.redirect(
        new URL("/integrations?linkedin_error=not_configured", request.url),
      );
    }
    if (err instanceof AppError && err.code === "unauthorized") {
      return NextResponse.redirect(new URL("/sign-in?next=/integrations", request.url));
    }
    return catchRouteError(err, requestId);
  }
}
