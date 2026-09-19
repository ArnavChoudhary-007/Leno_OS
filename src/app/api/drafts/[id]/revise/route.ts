import { NextResponse } from "next/server";
import { reviseWithNote } from "@/agents/orchestrator/revise-with-note";
import { ReviewNoteSchema } from "@/shared/schemas";

// Calls models and the DB — Node runtime, never edge.
export const runtime = "nodejs";

/** Rewrites one draft against a human's note and re-scores it. */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/drafts/[id]/revise"> ,
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = ReviewNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid note", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await reviseWithNote(id, parsed.data.note);
    return NextResponse.json({
      draft: result.after,
      critique: result.critique,
      superseded: result.before.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missing = message.includes("not found");
    return NextResponse.json({ error: message }, { status: missing ? 404 : 400 });
  }
}
