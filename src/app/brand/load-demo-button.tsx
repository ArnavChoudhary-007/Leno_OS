"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadDemoBrand } from "./actions";

export function LoadDemoButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      "This replaces your current brand profile with the Loopwave Audio demo brand. Continue?",
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await loadDemoBrand();
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? "Loading demo…" : "Load demo brand"}
    </Button>
  );
}
