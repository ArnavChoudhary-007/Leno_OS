"use client";

import { useState, useTransition, type FormEvent } from "react";
import { apiErrorMessage } from "@/lib/api-error";
import { InviteCreateSchema } from "@/shared/schemas";

/** Owners and admins create a single-use invite link for a teammate. */
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
    if (!parsed.success) {
      setError("Enter a valid email and role.");
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch("/api/workspace/invites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const result: unknown = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(apiErrorMessage(result, "Could not create invitation."));
        const link = result && typeof result === "object" && "url" in result && typeof result.url === "string" ? result.url : null;
        if (!link) throw new Error("Could not create invitation.");
        setUrl(link);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create invitation.");
      }
    });
  }

  return (
    <section className="l-card l-stack-12" aria-labelledby="invite-heading">
      <h2 id="invite-heading" className="l-card-title">
        Invite a teammate
      </h2>
      <p className="l-int-what">
        Creates a single-use link that works for seven days. The person needs a sign-in account with this email; Leno
        doesn’t send the email for you.
      </p>
      <form onSubmit={submit} className="l-invite">
        <label htmlFor="invite-email" className="sr-only-l">
          Teammate’s email
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="teammate@example.com"
          disabled={pending}
          className="l-input l-input-deep"
          style={{ flex: "1 1 240px" }}
        />
        <label htmlFor="invite-role" className="sr-only-l">
          Workspace role
        </label>
        <select id="invite-role" name="role" defaultValue="editor" disabled={pending} className="l-input l-input-deep">
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="l-btn l-btn-lime" disabled={pending}>
          {pending ? "Creating…" : "Create invite link"}
        </button>
      </form>
      {url ? (
        <div className="l-invite">
          <label htmlFor="invite-link" className="sr-only-l">
            Invite link
          </label>
          <input
            id="invite-link"
            readOnly
            value={url}
            className="l-input l-input-deep mono"
            style={{ flex: "1 1 320px", fontSize: 13 }}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className="l-btn l-btn-outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setError("Select and copy the link manually.");
              }
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="l-alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
