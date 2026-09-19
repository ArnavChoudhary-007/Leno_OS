import { loadPageAuth } from "@/auth/server";
import { can } from "@/authz/can";
import { AppShell } from "@/components/app-shell";
import { NoWorkspace } from "@/components/no-workspace";
import { env } from "@/env";
import { blueskyConfigured } from "@/tools/social/bluesky";
import {
  linkedinAccountName,
  linkedinConfigured,
  linkedinConnected,
  linkedinAppRedirectUri,
} from "@/tools/social/linkedin";
import { tavilyConfigured } from "@/tools/tavily";
import { LinkedInActions } from "./linkedin-actions";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await loadPageAuth();
  if (!ctx) return <NoWorkspace />;

  const params = (await searchParams) ?? {};
  const linkedinError = Array.isArray(params.linkedin_error)
    ? params.linkedin_error[0]
    : params.linkedin_error;
  const linkedinJustConnected =
    (Array.isArray(params.linkedin) ? params.linkedin[0] : params.linkedin) ===
    "connected";

  const [linkedinOn, linkedinName] = await Promise.all([
    linkedinConnected(ctx.workspaceId),
    linkedinAccountName(ctx.workspaceId),
  ]);
  const bluesky = blueskyConfigured();
  const linkedinReady = linkedinConfigured();
  const tavily = tavilyConfigured();

  const oauthErrorNote =
    linkedinError === "denied"
      ? "LinkedIn access was declined."
      : linkedinError === "state"
        ? "The LinkedIn sign-in expired. Connect again."
        : linkedinError === "token"
          ? "LinkedIn did not finish connecting. Check the app products and redirect URL."
          : linkedinError === "not_configured"
            ? "LinkedIn OAuth keys are missing from the server environment."
            : null;

  return (
    <AppShell
      email={ctx.email}
      role={ctx.role}
      canMutate={can(ctx.role, "mutate")}
      current="integrations"
      workspaceId={ctx.workspaceId}
    >
      <div className="integrations-container">
        <div className="integrations-header">
          <div>
            <h2 className="integrations-title">Platform Integrations</h2>
            <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginTop: 2 }}>
              Authorize connected social channels. Agents never publish — only approved drafts do.
            </p>
          </div>
        </div>
        {oauthErrorNote ? (
          <p className="integration-banner integration-banner-error">{oauthErrorNote}</p>
        ) : null}
        {linkedinJustConnected ? (
          <p className="integration-banner integration-banner-ok">
            LinkedIn is connected. Approved LinkedIn drafts can publish to this account.
          </p>
        ) : null}
        <div className="integrations-grid">
          <article className="integration-card">
            <div className="integration-card-header">
              <div className="integration-identity">
                <div className="integration-logo-box">Bl</div>
                <div className="integration-names">
                  <span className="integration-name">Bluesky</span>
                  <span className="integration-account-handle">
                    {bluesky ? "Configured via env" : "Not connected"}
                  </span>
                </div>
              </div>
              <span className={`badge badge-${bluesky ? "green" : "amber"}`}>
                <span className="badge-dot" />
                {bluesky ? "Connected" : "Not configured"}
              </span>
            </div>
            <div className="integration-card-body">
              AT Protocol publish path for X, Instagram, and Threads drafts.
            </div>
            <div className="integration-meta-list">
              <div className="integration-meta-item">
                <span>API Gateway</span>
                <strong>AT Protocol / bsky.social</strong>
              </div>
              <div className="integration-meta-item">
                <span>Last Sync</span>
                <strong>
                  {bluesky ? "Ready to publish approved drafts" : "Add BLUESKY_HANDLE"}
                </strong>
              </div>
              <div className="integration-meta-item">
                <span>OAuth Scopes</span>
                <span>{bluesky ? 1 : 0} active</span>
              </div>
            </div>
          </article>

          <article className="integration-card">
            <div className="integration-card-header">
              <div className="integration-identity">
                <div className="integration-logo-box">In</div>
                <div className="integration-names">
                  <span className="integration-name">LinkedIn</span>
                  <span className="integration-account-handle">
                    {linkedinOn ? linkedinName ?? "Connected" : "Not connected"}
                  </span>
                </div>
              </div>
              <span className={`badge badge-${linkedinOn ? "green" : linkedinReady ? "amber" : "neutral"}`}>
                <span className="badge-dot" />
                {linkedinOn ? "Connected" : linkedinReady ? "Ready to connect" : "Not configured"}
              </span>
            </div>
            <div className="integration-card-body">
              Member posts after human approval. Redirect URL: {linkedinAppRedirectUri()}
            </div>
            <div className="integration-meta-list">
              <div className="integration-meta-item">
                <span>API Gateway</span>
                <strong>LinkedIn UGC / Share on LinkedIn</strong>
              </div>
              <div className="integration-meta-item">
                <span>Last Sync</span>
                <strong>
                  {linkedinOn
                    ? "Ready to publish approved LinkedIn drafts"
                    : "Connect an account"}
                </strong>
              </div>
              <div className="integration-meta-item">
                <span>OAuth Scopes</span>
                <span>{linkedinOn ? 4 : 0} active</span>
              </div>
            </div>
            <div className="integration-card-footer">
              {can(ctx.role, "mutate") ? (
                <LinkedInActions
                  configured={linkedinReady}
                  connected={linkedinOn}
                  account={linkedinName}
                />
              ) : (
                <p className="integration-footer-note">
                  An editor can connect LinkedIn for this workspace.
                </p>
              )}
            </div>
          </article>

          <article className="integration-card">
            <div className="integration-card-header">
              <div className="integration-identity">
                <div className="integration-logo-box">Tv</div>
                <div className="integration-names">
                  <span className="integration-name">Tavily</span>
                  <span className="integration-account-handle">
                    {tavily ? "Research enabled" : "Not configured"}
                  </span>
                </div>
              </div>
              <span className={`badge badge-${tavily ? "green" : "neutral"}`}>
                <span className="badge-dot" />
                {tavily ? "Connected" : "Optional"}
              </span>
            </div>
            <div className="integration-card-body">
              Live web research injected into LinkedIn drafts. Writer still uses the existing model; images still use OpenAI.
            </div>
            <div className="integration-meta-list">
              <div className="integration-meta-item">
                <span>API Gateway</span>
                <strong>Tavily Search</strong>
              </div>
              <div className="integration-meta-item">
                <span>Last Sync</span>
                <strong>{tavily ? "Used on LinkedIn campaign runs" : "Add TAVILY_API_KEY"}</strong>
              </div>
              <div className="integration-meta-item">
                <span>OAuth Scopes</span>
                <span>{tavily ? 1 : 0} active</span>
              </div>
            </div>
          </article>

          <article className="integration-card">
            <div className="integration-card-header">
              <div className="integration-identity">
                <div className="integration-logo-box">Ig</div>
                <div className="integration-names">
                  <span className="integration-name">Instagram</span>
                  <span className="integration-account-handle">Coming later</span>
                </div>
              </div>
              <span className="badge badge-neutral">
                <span className="badge-dot" />
                Planned
              </span>
            </div>
            <div className="integration-card-body">Professional Creator Account</div>
            <div className="integration-meta-list">
              <div className="integration-meta-item">
                <span>API Gateway</span>
                <strong>Meta Graph API</strong>
              </div>
              <div className="integration-meta-item">
                <span>Last Sync</span>
                <strong>—</strong>
              </div>
              <div className="integration-meta-item">
                <span>OAuth Scopes</span>
                <span>0 active</span>
              </div>
            </div>
          </article>
        </div>
        <p className="integration-footer-note" style={{ marginTop: 4 }}>
          OpenAI images and the current writer key are already in the server environment.
          Redirect origin: {env.APP_URL}
        </p>
      </div>
    </AppShell>
  );
}
