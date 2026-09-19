import { NextResponse } from "next/server";
import { AppError, errorPayload, toAppError } from "@/shared/errors";
import type { ErrorCode } from "@/shared/types";
import { env } from "@/env";

export function requestIdFrom(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function jsonError(
  err: AppError,
  init?: { requestId?: string },
): NextResponse {
  const body = errorPayload(err);
  const res = NextResponse.json(body, { status: err.status });
  if (init?.requestId) res.headers.set("x-request-id", init.requestId);
  return res;
}

export function jsonErrorCode(
  code: ErrorCode,
  init?: { requestId?: string; message?: string },
): NextResponse {
  return jsonError(new AppError(code, init?.message), init);
}

export function catchRouteError(err: unknown, requestId: string): NextResponse {
  const appErr = toAppError(err);
  if (!(err instanceof AppError)) {
    console.error(`[api] ${requestId} ${appErr.code}:`, err);
  } else {
    console.warn(`[api] ${requestId} ${appErr.code}: ${appErr.message}`);
  }
  return jsonError(appErr, { requestId });
}

/**
 * Mutating browser calls send Origin. Same-origin fetch from this app is
 * allowed; cross-site is not. Server-to-server (no Origin) is allowed.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let allowed: string;
  try {
    allowed = new URL(env.APP_URL).origin;
  } catch {
    throw new AppError("forbidden");
  }

  if (origin === allowed) return;

  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return;
  } catch {
    throw new AppError("forbidden");
  }

  throw new AppError("forbidden");
}

export function ipFromHeaders(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? "local";
}

export function clientIp(request: Request): string {
  return ipFromHeaders(request.headers);
}
