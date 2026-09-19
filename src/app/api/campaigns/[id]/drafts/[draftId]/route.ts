import { NextResponse } from "next/server";
import { requireAuthContext, requireCan } from "@/auth/server";
import {
  approveDraft,
  clearDraftSchedule,
  deleteDraft,
  editDraft,
  getDraftInWorkspace,
  rejectDraft,
  scheduleDraft,
} from "@/db/queries/drafts";
import {
  assertSameOrigin,
  catchRouteError,
  jsonErrorCode,
  requestIdFrom,
} from "@/lib/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { AppError } from "@/shared/errors";
import { DraftReviewSchema } from "@/shared/schemas";
import type { PlatformId } from "@/shared/types";
import { publishApprovedDraft, assertPublishReady } from "@/workflows/publish-draft";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/campaigns/[id]/drafts/[draftId]">,
) {
  const requestId = requestIdFrom(request);
  try {
    assertSameOrigin(request);
    const ctx = await requireAuthContext();
    requireCan(ctx, "mutate");
    await consumeRateLimit(RATE_LIMITS.draftMutate(ctx.userId));

    const { id: campaignId, draftId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AppError("invalid_body", "Body must be JSON");
    }

    const parsed = DraftReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_body",
            message: "Invalid review action",
            issues: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    const existing = await getDraftInWorkspace(ctx.workspaceId, draftId);
    if (!existing || existing.campaign_id !== campaignId) {
      throw new AppError("not_found", "Draft not found");
    }

    const action = parsed.data;

    if (existing.status === "published" && action.action !== "publish") {
      throw new AppError("conflict", "Published drafts cannot be changed");
    }

    if (action.action === "approve") {
      requireCan(ctx, "approve");
      const draft = await approveDraft(draftId);
      return NextResponse.json({ draft });
    }
    if (action.action === "reject") {
      requireCan(ctx, "approve");
      const draft = await rejectDraft(draftId, action.review_note);
      return NextResponse.json({ draft });
    }
    if (action.action === "edit") {
      const draft = await editDraft(draftId, action.body, action.hashtags);
      return NextResponse.json({ draft });
    }
    if (action.action === "schedule") {
      requireCan(ctx, "publish");
      if (existing.status !== "approved" && existing.status !== "draft") {
        throw new AppError("conflict", "Only approved drafts can be scheduled");
      }
      if (existing.status !== "approved") {
        await approveDraft(draftId);
      }
      const when = new Date(action.scheduled_at);
      if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        throw new AppError("invalid_body", "scheduled_at must be a future time");
      }
      const draft = await scheduleDraft(draftId, action.scheduled_at);
      return NextResponse.json({ draft });
    }
    if (action.action === "clear_schedule") {
      requireCan(ctx, "publish");
      const draft = await clearDraftSchedule(draftId);
      return NextResponse.json({ draft });
    }
    if (action.action === "delete") {
      if (existing.status === "published") {
        throw new AppError("conflict", "Published drafts cannot be deleted");
      }
      await deleteDraft(draftId);
      return NextResponse.json({ ok: true });
    }

    requireCan(ctx, "publish");
    await assertPublishReady(ctx.workspaceId, existing.platform as PlatformId);
    try {
      const { draft, url } = await publishApprovedDraft(draftId);
      return NextResponse.json({ draft, url });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("job_failed");
    }
  } catch (err) {
    if (err instanceof AppError) {
      return jsonErrorCode(err.code, { requestId, message: err.message });
    }
    return catchRouteError(err, requestId);
  }
}
