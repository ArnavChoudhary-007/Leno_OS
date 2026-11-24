import { NextResponse } from "next/server";
import { authorizeMutation } from "@/auth/mutation";
import { requireCan } from "@/auth/server";
import { isAdminRole } from "@/authz/can";
import { applyDraftReview, getDraftInWorkspace } from "@/db/queries/drafts";
import { reconcilePublication } from "@/db/queries/publications";
import { catchRouteError, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";
import { DraftReviewSchema } from "@/shared/schemas";
import type { PlatformId } from "@/shared/types";
import { assertPublishReady, publishApprovedDraft } from "@/workflows/publish-draft";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RouteContext<"/api/campaigns/[id]/drafts/[draftId]">) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await authorizeMutation(request);
    const { id: campaignId, draftId } = await params;
    const parsed = DraftReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("invalid_body", "Invalid review action. Check the copy, note, or scheduled date.");
    const existing = await getDraftInWorkspace(ctx.workspaceId, draftId);
    if (!existing || existing.campaign_id !== campaignId) throw new AppError("not_found", "Draft not found");
    const action = parsed.data;
    if (action.action === "resolve_publication") {
      requireCan(ctx, "publish");
      if (!isAdminRole(ctx.role)) throw new AppError("forbidden", "Only workspace administrators can reconcile publications.");
      if (action.outcome === "published") {
        const url = new URL(action.published_url ?? "https://invalid.invalid");
        const hosts = existing.platform === "linkedin" ? ["linkedin.com", "www.linkedin.com"] : ["bsky.app"];
        if (url.protocol !== "https:" || !hosts.includes(url.hostname)) throw new AppError("invalid_body", "Provide the actual post URL on the connected platform.");
      }
      const draft = await reconcilePublication(ctx.workspaceId, draftId, action.outcome, action.outcome === "published" ? action.published_url : undefined);
      return NextResponse.json({ draft });
    }
    if (action.action === "publish") {
      requireCan(ctx, "publish");
      return NextResponse.json(await publishApprovedDraft(draftId));
    }
    if (action.action === "schedule" || action.action === "clear_schedule") requireCan(ctx, "publish");
    if (action.action === "schedule") await assertPublishReady(ctx.workspaceId, existing.platform as PlatformId);
    if (action.action === "approve" || action.action === "reject") requireCan(ctx, "approve");
    const draft = await applyDraftReview(ctx.workspaceId, draftId, action);
    return NextResponse.json({ draft, ok: true });
  } catch (err) {
    return catchRouteError(err, requestId);
  }
}
