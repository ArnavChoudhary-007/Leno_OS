/** Small cross-cutting helpers shared by db, agents, and workflows code. */

/** Generates a text primary-key id. All tables use text ids, not integers. */
export function newId(): string {
  return crypto.randomUUID();
}

/** Current time as an ISO-8601 string, the timestamp format used everywhere. */
export function nowIso(): string {
  return new Date().toISOString();
}
