# Database architecture

Schema source of truth: `src/db/schema.ts`. Input/output validation lives in
`src/shared/schemas.ts`; inferred application types live in `src/shared/types.ts`.
This document includes the workflow-integrity migration `0007`.

## Access and tenancy

- Supabase hosts Postgres. Server code uses postgres.js and Drizzle over
  `DATABASE_URL`, not PostgREST. DB route handlers use the Node.js runtime.
- Supabase Auth provides sign-in; `workspace_members` maps an authenticated
  user to one workspace and an owner/admin/editor/viewer role.
- Every campaign, draft, run step, publication, brand profile and connection
  belongs to a workspace. Browser resource lookups must include workspace scope.
- RLS is enabled in both the Drizzle schema and migrations, with no public
  policies. The server requires an appropriate direct database role; RLS is not
  forced on the table owner. Never expose connection strings or service keys.

## Tables

| Table | Purpose and important constraints |
| --- | --- |
| `workspaces` | Team identity, unique slug and default timezone |
| `workspace_members` | User membership and role; unique user, one workspace per user |
| `workspace_invites` | Email-bound invitations, SHA-256 token hash, role, expiry and acceptance timestamp |
| `brand_profile` | Company context, voice, examples, visual identity and guidelines; scoped by workspace |
| `platform_connections` | Per-workspace LinkedIn OAuth credentials and expiry; unique workspace/platform |
| `rate_limit_buckets` | Shared database-backed request limits |
| `campaigns` | Brief, structured options, plan, goal, active run identity, brand snapshot, counters and summary |
| `drafts` | Per-platform version history, copy/hashtags, image URL, critique, human review, schedule and publication state |
| `run_steps` | Append-only agent timeline, model, phase, output and elapsed time |
| `publications` | Durable attempts linking a draft and workspace to a provider and its outcome |

### Campaigns and generation

`campaigns.options` is nullable JSONB for legacy compatibility. New inputs use
`CampaignOptionsSchema`: selected platforms, creativity, research toggle/depth,
length, brand-voice toggle and source mode. Missing legacy options use defaults.
Source mode is context, not permission to fetch arbitrary URLs.

`run_id` identifies the caller that atomically claimed a queued/stale campaign.
Plan/snapshot writes, draft inserts, settlement and completion are fenced to that
identity. Each new claim resets `llm_calls`; it counts provider attempts including
retries/fallbacks. Finished summaries also distinguish `logical_calls` and
`provider_attempts`; these fields are optional when reading older summaries.
Strategy stays in `run_steps`, not a duplicated campaign column.

Campaign states are `queued`, `running`, `ready`, `needs_human`, and `failed`.
The worker recovers abandoned queued/running campaigns after five minutes using
conditional updates against the observed identity and claim time. This recovery
must not overwrite a newer run. Low-level stale claiming uses a 30-minute window.

### Drafts and review

A draft stores body and hashtags separately. Publishing composes them in plain
code and applies the platform limits. Approval/scheduling validate the current
copy too. Draft versions have a unique `(campaign_id, platform, version)` index.
All version allocations serialize on the campaign row and use the actual maximum
version plus one, including reruns and human edits.

States: `draft`, `needs_human`, `approved`, `rejected`, `superseded`,
`publishing`, `publish_failed`, and `published`.

- Review/revision/publication transactions lock the campaign before the draft.
  Human mutations wait until generation has finished.
- Published and unresolved publication attempts cannot be edited, rejected,
  revised or deleted. Scheduled drafts must be unscheduled before AI revision.
- `revision_token` and `revision_started_at` reserve a human-note revision.
  Claims expire after five minutes; stale completions cannot retire newer copy.
- Edited approval/scheduling writes a new version and applies the human action
  in one transaction. Edits/rejections retire any old schedule.
- Current-version queries exclude `superseded` rows. Publication history is
  preserved when later generation produces newer versions.
- `scheduled_at` is timestamptz. API input must be a future timestamp; the worker
  checks the exact observed schedule while claiming, preventing stale due-list
  entries from publishing a cancelled or rescheduled post.
- `schedule_attempts` tracks capped exponential preflight retries. After five
  failures, human intervention is required.
- `published_at` is the confirmed local completion/reconciliation time, not an
  inferred creation date. Legacy published rows remain null; no time is invented.
- Analytics reads all draft versions created/published in the maximum 90-day
  window, not just current versions or a 200-row sample.

### Publication ledger

`publications` contains `draft_id`, `workspace_id`, `provider`, `status`,
`external_url`, `error`, and creation/update timestamps. Its draft foreign key
uses `ON DELETE RESTRICT` to retain evidence of external actions. The table has
RLS and a `(draft_id, created_at)` index. Drafts have a `(status, scheduled_at)`
index for due-list discovery.

Providers are selected deterministically: LinkedIn for LinkedIn, Bluesky for
X-format drafts. Instagram/Threads are export-only; Facebook remains disabled.
The destination is shown in the UI and stored on the publication attempt.

A claim transaction requires human approval, inserts a `claimed` attempt and
moves the draft to `publishing` before any external write. Success updates the
attempt to `succeeded` and the draft to `published`, recording URL and time.
An ambiguous provider/database failure becomes `unknown` plus `publish_failed`.
Abandoned claims older than ten minutes are recovered as unknown, never retried
blindly. Owner/admin reconciliation records success with an actual platform URL,
or marks the attempt failed and unlocks the approved draft for explicit retry.
This prevents automatic duplicate attempts; it does not claim distributed
exactly-once delivery or provider-side idempotency.

### Invitations

Owners/admins can create seven-day, single-use invitation links under
Integrations. Only a token hash is stored; the raw link is returned once without
caching. Acceptance requires an authenticated matching email and atomically
creates membership and consumes the invite under a row lock. Recipients need an
existing Auth account. This flow does not send email or provision accounts.

## Migrations and operational verification

1. Back up the database and persistent uploads; test against a database copy.
2. Stop old scheduling workers for a schema-changing deployment.
3. Run `npm run db:migrate` using a direct/session connection before starting
   either the updated web process or the worker. Migration `0007` is additive;
   pre-existing publications are not assigned fabricated timestamps.
4. Run `npm run test:db` against a dedicated migrated test database. It creates
   and cleans up isolated fixtures, exercising claims, version races, workspace
   scope, schedules, publication recovery and invitation acceptance.
5. Build and start both processes; verify one real approved/scheduled post on
   each configured provider. Never run integration tests against production.

Rollback is a coordinated application/database restore from a reviewed backup,
not an automatic destructive down migration. Preserve publication evidence and
reconcile external posts before replaying any work. The database suite and real
provider checks require infrastructure; a successful compile is not proof that
these operational checks have passed.
