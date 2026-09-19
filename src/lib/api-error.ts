/** Read a sanitized API error from either the new or legacy response shape. */
export function apiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  if (!("error" in data)) return fallback;
  const error = data.error;
  if (typeof error === "string" && error.length > 0) return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length > 0
  ) {
    return error.message;
  }
  return fallback;
}
