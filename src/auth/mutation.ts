import { requireAuthContext, requireCan } from "@/auth/server";
import type { AuthzAction } from "@/authz/can";
import { assertSameOrigin } from "@/lib/http";
import { consumeRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function authorizeMutation(
  request: Request,
  action: AuthzAction = "mutate",
  bucket: "campaign" | "draft" = "draft",
) {
  assertSameOrigin(request);
  const ctx = await requireAuthContext();
  requireCan(ctx, action);
  await consumeRateLimit(bucket === "campaign"
    ? RATE_LIMITS.campaignCreate(ctx.userId)
    : RATE_LIMITS.draftMutate(ctx.userId));
  return ctx;
}
