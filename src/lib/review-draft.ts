import type { DraftReview } from "@/shared/types";
import { apiErrorMessage } from "@/lib/api-error";

export async function reviewDraft(
  campaignId: string,
  draftId: string,
  action: DraftReview,
): Promise<Response> {
  return fetch(`/api/campaigns/${campaignId}/drafts/${draftId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
}

export async function reviewDraftOrThrow(
  campaignId: string,
  draftId: string,
  action: DraftReview,
): Promise<void> {
  const res = await reviewDraft(campaignId, draftId, action);
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => ({}));
    throw new Error(apiErrorMessage(data, `Request failed (${res.status})`));
  }
}

export function localToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
