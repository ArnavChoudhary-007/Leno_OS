"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ReviewNoteSchema } from "@/shared/schemas";
import { apiErrorMessage } from "@/lib/api-error";

export function DraftRevisionNote({ draftId, onChanged }: {
  draftId: string;
  onChanged: () => void | Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function revise() {
    const result = ReviewNoteSchema.safeParse({ note });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Add a revision note");
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch(`/api/drafts/${draftId}/revise`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result.data),
        });
        if (!response.ok) {
          throw new Error(apiErrorMessage(await response.json().catch(() => ({})), `Revision failed (${response.status})`));
        }
        setNote("");
        toast.success("Revision requested");
        await onChanged();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not request revision");
      }
    });
  }

  return (
    <div className="input-group mt-3">
      <label className="input-label" htmlFor={`revision-${draftId}`}>Ask for a revision</label>
      <textarea id={`revision-${draftId}`} className="input-field" rows={3} maxLength={1000}
        value={note} disabled={pending} onChange={(event) => setNote(event.target.value)}
        placeholder="Describe what the writer should change (5-1000 characters). Saved copy is used; save any edits first." />
      <button type="button" className="btn btn-secondary" disabled={pending || note.trim().length < 5} onClick={revise}>
        {pending ? "Revising..." : "Request revision"}
      </button>
    </div>
  );
}
