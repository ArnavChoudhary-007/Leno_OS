"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api-error";

export function LinkedInActions({
  configured,
  connected,
  account,
}: {
  configured: boolean;
  connected: boolean;
  account: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [isConnected, setConnected] = useState(connected);
  const [handle, setHandle] = useState(account);

  if (!configured) {
    return (
      <p className="integration-footer-note">
        Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET, then restart the app.
      </p>
    );
  }

  if (!isConnected) {
    return (
      <a
        href="/api/integrations/linkedin/connect"
        className={buttonVariants({ size: "sm" })}
      >
        Connect LinkedIn
      </a>
    );
  }

  function disconnect() {
    startTransition(async () => {
      const res = await fetch("/api/integrations/linkedin/disconnect", {
        method: "POST",
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(apiErrorMessage(data, `Disconnect failed (${res.status})`));
        return;
      }
      setConnected(false);
      setHandle(null);
      toast.success("LinkedIn disconnected");
    });
  }

  return (
    <div className="integration-actions-row">
      {handle ? (
        <span className="integration-footer-note">Signed in as {handle}</span>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={disconnect}
      >
        Disconnect
      </Button>
    </div>
  );
}
