import type { WorkspaceRole } from "@/shared/types";

export type AuthContext = {
  userId: string;
  email: string | null;
  workspaceId: string;
  role: WorkspaceRole;
};
