"use client";

import { useSyncExternalStore } from "react";
import { greetingFor } from "@/lib/workspace-ui";

const subscribe = () => () => {};

/** Date line + time-of-day greeting in the viewer's own clock. */
export function Greeting({ name }: { name: string }) {
  // Server renders a neutral line; the browser swaps in its local time.
  const local = useSyncExternalStore(
    subscribe,
    () => {
      const now = new Date();
      return `${now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}|${greetingFor(now)}`;
    },
    () => "|Hello",
  );
  const [date, hello] = local.split("|");
  return (
    <div className="l-page-header-text">
      <span className="l-eyebrow">{date || " "}</span>
      <h1 className="l-h1">
        {hello}, <span className="l-lime">{name}</span>
      </h1>
    </div>
  );
}
