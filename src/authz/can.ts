import type { WorkspaceRole } from "@/shared/types";

export type AuthzAction =
  | "read"
  | "mutate"
  | "approve"
  | "publish"
  | "invite"
  | "load_demo";

const EDITOR_PLUS: ReadonlySet<WorkspaceRole> = new Set([
  "editor",
  "admin",
  "owner",
]);
const ADMIN_PLUS: ReadonlySet<WorkspaceRole> = new Set(["admin", "owner"]);

export function can(role: WorkspaceRole, action: AuthzAction): boolean {
  switch (action) {
    case "read":
      return true;
    case "mutate":
    case "approve":
    case "publish":
      return EDITOR_PLUS.has(role);
    case "invite":
    case "load_demo":
      return ADMIN_PLUS.has(role);
  }
}

export function isAdminRole(role: WorkspaceRole): boolean {
  return ADMIN_PLUS.has(role);
}
