import { NextResponse } from "next/server";
import { authorizeMutation } from "@/auth/mutation";
import { reviseWithNote } from "@/agents/orchestrator/revise-with-note";
import { getDraftInWorkspace } from "@/db/queries/drafts";
import { catchRouteError, requestIdFrom } from "@/lib/http";
import { AppError } from "@/shared/errors";
import { ReviewNoteSchema } from "@/shared/schemas";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RouteContext<"/api/drafts/[id]/revise">) {
  const requestId = requestIdFrom(request);
  try {
    const ctx = await authorizeMutation(request);
    const { id } = await params;
    const draft = await getDraftInWorkspace(ctx.workspaceId, id);
    if (!draft) throw new AppError("not_found", "Draft not found");
    const parsed = ReviewNoteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("invalid_body", "Add a revision note between 5 and 1000 characters.");
    const result = await reviseWithNote(id, parsed.data.note);
    return NextResponse.json({ draft: result.after, critique: result.critique, superseded: result.before.id });
  } catch (err) {
    return catchRouteError(err, requestId);
  }
}
