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
      await loadDemoBrand();
      toast.success("Demo brand loaded");
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
