import { NextResponse } from "next/server";
import { requireAuthContext, requireCan } from "@/auth/server";
import {
  assertSameOrigin,
  catchRouteError,
  jsonErrorCode,
  requestIdFrom,
} from "@/lib/http";
import { AppError } from "@/shared/errors";
import { disconnectLinkedIn } from "@/tools/social/linkedin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");
    await disconnectLinkedIn(ctx.workspaceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return catchRouteError(err, requestId);
  }
}
