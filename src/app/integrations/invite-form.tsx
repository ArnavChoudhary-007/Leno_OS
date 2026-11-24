"use client";

import { useState, useTransition, type FormEvent } from "react";
import { apiErrorMessage } from "@/lib/api-error";
import { InviteCreateSchema } from "@/shared/schemas";

export function InviteForm() {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = InviteCreateSchema.safeParse({ email: form.get("email"), role: form.get("role") });
    setUrl(null);
    setCopied(false);
    setError(null);
    if (!parsed.success) { setError("Enter a valid email and role."); return; }
    startTransition(async () => {
      try {
        const response = await fetch("/api/workspace/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
        const result = await response.json();
        if (!response.ok) throw new Error(apiErrorMessage(result, "Could not create invitation."));
        setUrl(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create invitation.");
      }
    });
  }

  return (
    <section className="integration-card" style={{ padding: 20 }} aria-labelledby="invite-heading">
      <h2 id="invite-heading">Invite a teammate</h2>
      <p>Share a single-use link valid for seven days. The recipient needs an existing sign-in account with this email; no email is sent automatically.</p>
      <form onSubmit={submit} className="flex flex-wrap gap-3 mt-3">
        <input aria-label="Invited email" name="email" type="email" required placeholder="teammate@example.com" disabled={pending} className="rounded-md border p-2" />
        <select aria-label="Workspace role" name="role" defaultValue="editor" disabled={pending} className="rounded-md border p-2">
          <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option>
        </select>
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Creating..." : "Create invite link"}</button>
      </form>
      {url ? <div className="mt-3 flex flex-wrap gap-3">
        <input aria-label="Invite link" readOnly value={url} className="rounded-md border p-2 flex-1" onFocus={(event) => event.currentTarget.select()} />
        <button type="button" className="btn btn-subtle" onClick={async () => {
          try { await navigator.clipboard.writeText(url); setCopied(true); }
          catch { setError("Select and copy the link manually."); }
        }}>{copied ? "Copied" : "Copy link"}</button>
      </div> : null}
      {error ? <p role="alert" className="text-destructive mt-2">{error}</p> : null}
    </section>
  );
}
