import { ERROR_CODES, type ErrorCodeSchema } from "@/shared/schemas";
import type { ErrorCode } from "@/shared/types";

export type { ErrorCode };

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  unauthorized: "Sign in to continue.",
  forbidden: "You do not have permission to do that.",
  not_found: "Not found.",
  invalid_body: "The request body is invalid.",
  conflict: "This action conflicts with the current state.",
  queue_full: "Too many campaigns are already running. Try again shortly.",
  rate_limited: "Too many requests. Try again shortly.",
  not_publishable: "This draft cannot be published to that channel.",
  not_configured: "That integration is not configured.",
  job_failed: "The job failed. Try again, or check the campaign timeline.",
  no_workspace: "Your account is not in a workspace yet. Ask an owner to invite you.",
};

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_body: 400,
  conflict: 409,
  queue_full: 409,
  rate_limited: 429,
  not_publishable: 409,
  not_configured: 400,
  job_failed: 400,
  no_workspace: 403,
};

const CODE_SET = new Set<string>(ERROR_CODES);

export function isErrorCode(value: string): value is ErrorCode {
  return CODE_SET.has(value);
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export function errorPayload(err: AppError): {
  error: { code: ErrorCode; message: string };
} {
  return { error: { code: err.code, message: err.message } };
}

/** Never send provider / SQL strings to the client. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  return new AppError("job_failed");
}

export type { ErrorCodeSchema };
