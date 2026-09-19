"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptInviteState } from "@/auth/actions";
import { Button } from "@/components/ui/button";

const initial: AcceptInviteState = { ok: false };

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {state.message ? (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} size="lg">
        {pending ? "Joining…" : "Join workspace"}
      </Button>
    </form>
  );
}
