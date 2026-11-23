import { loadPageAuth } from "@/auth/server";
import { isPublicDemo } from "@/auth/public-demo";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import { PageHeader } from "@/components/page-header";
import { getPlatformConnection } from "@/db/queries/connections";
import { env } from "@/env";
import { relativeTime } from "@/lib/workspace-ui";
import { isImageGenerationConfigured } from "@/tools/openai-image";
import { blueskyConfigured } from "@/tools/social/bluesky";
import { linkedinAppRedirectUri, linkedinConfigured } from "@/tools/social/linkedin";
import { tavilyConfigured } from "@/tools/tavily";
import { IntegrationCard, type IntegrationItem } from "./integration-card";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const params = (await searchParams) ?? {};
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const linkedinError = first(params.linkedin_error);
  const justConnected = first(params.linkedin) === "connected";

  const connection = await getPlatformConnection(ctx.workspaceId, "linkedin");
  // Same rule as publishing: a stored connection counts (tokens refresh on use).
  const linkedinOn = Boolean(connection);
  const linkedinReady = linkedinConfigured();
  const bluesky = blueskyConfigured();
  const canMutate = can(ctx.role, "mutate");
  const demo = isPublicDemo();

  const oauthNote =
    linkedinError === "denied"
      ? "LinkedIn access was declined."
      : linkedinError === "state"
        ? "The LinkedIn sign-in expired. Connect again."
        : linkedinError === "token"
          ? "LinkedIn didn’t finish connecting. Check the app’s products and redirect URL."
          : linkedinError === "not_configured"
            ? "LinkedIn keys are missing from the server environment."
            : null;

  const items: IntegrationItem[] = [
    {
      id: "linkedin",
      label: "LinkedIn",
      account: linkedinOn ? connection!.account_name : linkedinReady ? "Not connected" : "Needs app keys",
      state: linkedinOn ? "Connected" : linkedinReady ? "Not connected" : "Not set up",
      what: "Approved LinkedIn posts publish straight to this account, now or at the time you schedule.",
      details: [
        { term: "Connection", value: "Share on LinkedIn (OAuth)" },
        {
          term: "Connected",
          value: linkedinOn ? relativeTime(connection!.updated_at) : "—",
        },
        {
          term: "Token renews",
          value: linkedinOn ? new Date(connection!.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—",
        },
        { term: "Permissions", value: linkedinOn ? connection!.scopes.replace(/[ ,]+/g, " · ") || "w_member_social" : "openid · profile · email · w_member_social", mono: true },
        { term: "Redirect URL", value: linkedinAppRedirectUri(), mono: true },
      ],
      action: !canMutate
        ? { kind: "note", text: "An editor can connect LinkedIn for this workspace." }
        : demo
          ? { kind: "note", text: "Connecting accounts is off in this public demo." }
          : !linkedinReady
            ? { kind: "note", text: "Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to the server, then restart." }
            : linkedinOn
              ? { kind: "linkedin-disconnect" }
              : { kind: "link", href: "/api/integrations/linkedin/connect", label: "Connect LinkedIn" },
    },
    {
      id: "bluesky",
      label: "Bluesky",
      account: bluesky ? env.BLUESKY_HANDLE ?? "Configured" : "Not set up",
      state: bluesky ? "Connected" : "Not set up",
      what: "Approved X, Instagram and Threads posts publish to Bluesky, so they go live somewhere real today.",
      details: [
        { term: "Connection", value: "AT Protocol app password" },
        { term: "Handle", value: env.BLUESKY_HANDLE || "—", mono: true },
        { term: "Set in", value: "BLUESKY_HANDLE, BLUESKY_APP_PASSWORD", mono: true },
      ],
      action: bluesky
        ? { kind: "none" }
        : { kind: "note", text: "Add a Bluesky handle and app password to the server environment." },
    },
    {
      id: "instagram",
      label: "Instagram",
      account: "Post by hand",
      state: "Export only",
      what: "Leno writes the caption and makes the image. Copy the caption and download the image from the post, then post it yourself.",
      details: [],
      action: { kind: "link", href: "/campaigns?status=Approved", label: "Find approved posts" },
    },
    {
      id: "threads",
      label: "Threads",
      account: "Post by hand",
      state: "Export only",
      what: "Leno writes the post to Threads’ 500-character limit. Copy it from the post and paste it into Threads.",
      details: [],
      action: { kind: "link", href: "/campaigns?status=Approved", label: "Find approved posts" },
    },
    {
      id: "tavily",
      label: "Tavily research",
      account: tavilyConfigured() ? "Search enabled" : "Optional",
      state: tavilyConfigured() ? "Connected" : "Not set up",
      what: "Live web sources for the LinkedIn writer, so claims have something behind them. Skipped when it isn’t set up.",
      details: [{ term: "Set in", value: "TAVILY_API_KEY", mono: true }],
      action: { kind: "none" },
    },
    {
      id: "openai",
      label: "OpenAI images",
      account: isImageGenerationConfigured() ? env.IMAGE_MODEL ?? "Image model" : "Optional",
      state: isImageGenerationConfigured() ? "Connected" : "Not set up",
      what: "Makes one image per campaign when you don’t upload a photo, then crops it for each platform.",
      details: [{ term: "Set in", value: "OPENAI_API_KEY, IMAGE_MODEL", mono: true }],
      action: { kind: "none" },
    },
  ];

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={canMutate}
      current="integrations"
      workspaceId={ctx.workspaceId}
    >
      <div className="l-page">
        <PageHeader
          title="Integrations"
          description="LinkedIn and Bluesky publish straight from Leno once you approve. Instagram and Threads give you the finished post and image to copy or download."
        />
        {oauthNote ? (
          <p role="alert" className="l-banner is-error">
            {oauthNote}
          </p>
        ) : null}
        {justConnected ? (
          <p role="status" className="l-banner is-ok">
            LinkedIn is connected. Approved LinkedIn posts can publish to this account.
          </p>
        ) : null}
        <div className="l-int-grid">
          {items.map((it) => (
            <IntegrationCard key={it.id} item={it} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
