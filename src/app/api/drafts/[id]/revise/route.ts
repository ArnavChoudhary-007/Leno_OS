import { NextResponse } from "next/server";
import { reviseWithNote } from "@/agents/orchestrator/revise-with-note";
import { requireAuthContext, requireCan } from "@/auth/server";
import { getDraftInWorkspace } from "@/db/queries/drafts";
import {
  assertSameOrigin,
  catchRouteError,
  jsonErrorCode,
  requestIdFrom,
} from "@/lib/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { AppError } from "@/shared/errors";
import { ReviewNoteSchema } from "@/shared/schemas";

// Calls models and the DB — Node runtime, never edge.
export const runtime = "nodejs";

/**
 * "Ask for changes": rewrites one draft against a human's note and
 * re-scores it. The result is a new version waiting for approval; nothing
 * here publishes.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/drafts/[id]/revise">,
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");
    await consumeRateLimit(RATE_LIMITS.draftRevise(ctx.userId));

    const { id } = await params;
    const existing = await getDraftInWorkspace(ctx.workspaceId, id);
    if (!existing) throw new AppError("not_found", "Draft not found");
    if (existing.status === "published") {
      throw new AppError("conflict", "Published posts can’t be rewritten");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("invalid_body", "Body must be JSON");
    }

    const parsed = ReviewNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_body",
            message: parsed.error.issues[0]?.message ?? "Invalid note",
            issues: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    try {
      const result = await reviseWithNote(id, parsed.data.note);
      const res = NextResponse.json({
        draft: result.after,
        critique: result.critique,
        superseded: result.before.id,
      });
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new AppError("conflict", message);
    }
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return catchRouteError(err, requestId);
  }
}
