"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, textareaClass } from "@/app/brand/field";
import { apiErrorMessage } from "@/lib/api-error";

const SAMPLE =
  "We are launching the Aero Case Pro, a charging case that adds 30 hours of battery to our earbuds. Launch week is next week. We want people who already own Aero earbuds to buy the case, and we want new buyers to see it as the reason to pick us. Keep it grounded — no spec-sheet bragging.";

export function BriefForm() {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = apiErrorMessage(data, `Request failed (${res.status})`);
        setError(message);
        toast.error(message);
        return;
      }
      if (
        data &&
        typeof data === "object" &&
        "id" in data &&
        typeof data.id === "string"
      ) {
        toast.success("Campaign queued");
        router.push(`/campaigns/${data.id}`);
        return;
      }
      setError("Unexpected response");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Campaign brief"
        htmlFor="brief"
        hint={`${brief.length}/2000`}
        error={error ? [error] : undefined}
      >
        <textarea
          id="brief"
          className={`${textareaClass} min-h-40`}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="What are we launching, who is it for, and what should the posts achieve? A few sentences is enough."
          maxLength={2000}
          disabled={pending}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={pending || brief.trim().length < 20} size="lg">
          {pending ? "Starting…" : "Run campaign"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setBrief(SAMPLE);
            toast.message("Sample brief loaded — you can edit it, then run.");
          }}
        >
          Load a sample brief
        </Button>
      </div>
    </div>
  );
}
