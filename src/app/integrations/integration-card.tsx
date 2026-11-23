"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api-error";

export type IntegrationItem = {
  id: string;
  label: string;
  account: string;
  state: "Connected" | "Not connected" | "Not set up" | "Export only";
  what: string;
  details: { term: string; value: string; mono?: boolean }[];
  action:
    | { kind: "none" }
    | { kind: "note"; text: string }
    | { kind: "link"; href: string; label: string }
    | { kind: "linkedin-disconnect" };
};

export function IntegrationCard({ item }: { item: IntegrationItem }) {
  const router = useRouter();
  const [showDetail, setShowDetail] = useState(false);
  const [pending, startTransition] = useTransition();
  const connected = item.state === "Connected";

  const badge =
    item.state === "Connected"
      ? "l-badge l-badge-lime"
      : item.state === "Export only"
        ? "l-badge"
        : "l-badge l-badge-dashed";

  function disconnect() {
    if (!window.confirm("Disconnect LinkedIn? Scheduled LinkedIn posts will wait until you reconnect.")) return;
    startTransition(async () => {
      const res = await fetch("/api/integrations/linkedin/disconnect", { method: "POST" });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(apiErrorMessage(data, `Disconnect failed (${res.status})`));
        return;
      }
      toast.success("LinkedIn disconnected");
      router.refresh();
    });
  }

  return (
    <article className={`l-card l-int${connected ? " is-on" : ""}`}>
      <header className="l-int-head">
        <div className="l-stack-4">
          <h2 className="l-card-title">{item.label}</h2>
          <span className="l-muted" style={{ fontSize: 14 }}>
            {item.account}
          </span>
        </div>
        <span className={badge} style={{ flex: "none" }}>
          {item.state}
        </span>
      </header>
      <p className="l-int-what">{item.what}</p>
      {showDetail && item.details.length ? (
        <dl className="l-int-dl">
          {item.details.map((d) => (
            <div key={d.term} style={{ display: "contents" }}>
              <dt>{d.term}</dt>
              <dd className={d.mono ? "mono" : undefined}>{d.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="l-int-actions">
        {item.action.kind === "link" ? (
          item.action.href.startsWith("/api/") ? (
            // Full navigation: the OAuth flow redirects off-site.
            <a href={item.action.href} className="l-btn l-btn-lime">
              {item.action.label}
            </a>
          ) : (
            <a href={item.action.href} className="l-btn l-btn-outline">
              {item.action.label}
            </a>
          )
        ) : null}
        {item.action.kind === "linkedin-disconnect" ? (
          <button type="button" className="l-btn l-btn-outline" disabled={pending} onClick={disconnect}>
            {pending ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : null}
        {item.details.length ? (
          <button
            type="button"
            className="l-more-btn"
            aria-expanded={showDetail}
            onClick={() => setShowDetail((v) => !v)}
          >
            {showDetail ? "Hide details" : "Show details"}
          </button>
        ) : null}
      </div>
      {item.action.kind === "note" ? (
        <p className="l-faint" style={{ margin: 0, fontSize: 14 }}>
          {item.action.text}
        </p>
      ) : null}
    </article>
  );
}
