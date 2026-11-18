import { createHash, randomBytes } from "node:crypto";
import { authorizeMutation } from "@/auth/mutation";
import { insertInvite } from "@/db/queries/workspaces";
import { env } from "@/env";
import { catchRouteError, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";
import { InviteCreateSchema } from "@/shared/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await authorizeMutation(request, "invite");
    const parsed = InviteCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("invalid_body", "Provide a valid email and workspace role.");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
    await insertInvite({ workspaceId: ctx.workspaceId, email: parsed.data.email.toLowerCase(), role: parsed.data.role,
      tokenHash: createHash("sha256").update(token).digest("hex"), invitedBy: ctx.userId, expiresAt });
    return Response.json({ url: new URL(`/invite/${token}`, env.APP_URL).href, expires_at: expiresAt },
      { status: 201, headers: { "cache-control": "no-store", "x-request-id": requestId } });
  } catch (err) {
    return catchRouteError(err, requestId);
  }
}
