import type { CreateForumRequest } from "../../types";

export const DEFAULT_ADMIN_FORUM_TYPE = "general" as const;

export function buildAdminForumCreatePayload(fields: Omit<CreateForumRequest, "forum_type"> & { forum_type?: unknown }): CreateForumRequest {
  return { ...fields, forum_type: DEFAULT_ADMIN_FORUM_TYPE };
}

// A neutral presentation must never change the value used for editing/saving.
export const isUndisplayedAdminStatus = (status?: string | null) =>
  status?.toLowerCase() === "pending";
