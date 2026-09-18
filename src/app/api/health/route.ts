import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

// Uses the DB, so it must run on the Node.js runtime, never edge.
export const runtime = "nodejs";

export async function GET() {
  await db.execute(sql`select 1`);
  return NextResponse.json({ ok: true });
}
