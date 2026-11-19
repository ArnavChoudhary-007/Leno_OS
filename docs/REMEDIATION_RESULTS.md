# Leno OS remediation results

Implementation review: 2026-11-18. Branch: `bug_fixes`.
The working tree is connected to the requested GitHub repository. Nothing has
been committed, pushed, deployed, migrated against a live database, or published
to a social account by this task. No dependencies were added.

## Finding coverage

Implemented means code and regression coverage exist; it does not mean the
database/provider scenarios have been exercised against live infrastructure.

| Finding | Change | Verification boundary |
| --- | --- | --- |
| F1 | Shared origin/auth/role/rate guard on revise/retry; workspace-scoped lookups; consistent errors | Permission/origin unit tests and route contract checks pass; real authenticated HTTP checks remain |
| F2 | Durable transactional publication claim, protected in-flight state, uncertain-outcome reconciliation | Typechecked; concurrency/publication DB tests added, not run locally |
| F3 | Atomic campaign claim and run-identity fences; stale recovery cannot overwrite a newer claim | DB concurrency/fencing tests added, not run locally |
| F4 | Campaign-locked maximum-plus-one draft versions; delivery/failure limited to current-run drafts | DB concurrent-version tests added, not run locally |
| F5 | Separate 30-second scheduler using the same publication workflow, exact-schedule claims, capped preflight backoff and graceful shutdown | Worker/config checked; real due-post and shutdown behavior require infrastructure |
| F6 | Current draft queries exclude superseded versions | DB regression added, not run locally |
| F7 | Published/publishing/uncertain drafts locked; scheduled revisions refused; expiring revision claims and transactional completion | State tests pass; DB protected-history checks added |
| F8 | Approve/schedule include current copy and hashtags atomically; editors remount when opening/switching drafts | UI/helper and editor-key contract tests pass; browser interaction QA remains |
| F9 | Future date validated before mutation; edits/rejections clear schedules; approvals enforce platform limits | Schema/state tests pass; atomic review and cancelled-schedule DB tests added |
| F10 | Only LinkedIn and X-format-to-Bluesky publish; other enabled channels export-only throughout UI/API | Destination and rendered-card tests pass; no live provider calls |
| F11 | All analytics KPIs/charts use the selected date window; publication time tracked; historical publications retained; no 200-row analytics cap | Date-window tests including >200 rows pass; DB history check added |
| F12 | Structured validated options persist; platform allowlist, temperature, research/depth, length and voice controls reach execution | Schema and async context tests pass; real generation/provider QA remains |
| F13 | Shared abort signal for model/research/image calls and retry waits; hard attempt ceiling; separate logical/provider counts | Budget/cancellation/isolation tests pass; real provider timing not exercised |
| F14 | Missing runtime DB config still fails; build-only inert fallback allows compilation without secrets | Secret-free production build passes |
| F15 | Non-root app/worker, shared persistent upload volume, documented absolute upload path | Configuration reviewed; Docker unavailable locally |
| D1 | Removed unreferenced hero/table components | Import checks, lint, typecheck and build pass |
| D2 | Removed unused Instagram daemon connector and misleading canned fallback; retained active playbook | Unit tests, lint, typecheck and build pass |
| D3 | Removed obsolete second image store and unscoped serving route | Import/route checks and build pass |
| D4 | Removed obsolete orchestrator stub-verification script; retained active image assertions | Unit/image checks pass |
| D5 | Added owner/admin invitation links rather than retaining dead creation helpers | Input/permission tests pass; single-use/email-bound DB test added |
| D6 | Drizzle RLS declarations match existing protected tables; new publication ledger is RLS-enabled | Migration generated and reviewed; not applied locally |
| V1 | Dependency-free portable Node test discovery replaces POSIX-only script syntax | Unit suite passes in Windows PowerShell |
| V2 | Cleared repository ESLint errors/warnings, including OG rendering and unused imports | Full ESLint passes |

## Other repaired UI behavior

- Generation, individual approvals and approve-all refresh their results.
- Polling aborts on cleanup and does not overlap requests.
- Published/in-flight/uncertain drafts are read-only; errors remain visible.
- Owners/admins can reconcile publication outcomes on the campaign detail page.
- Human revision notes are available from draft review surfaces.
- Platform agent counters reflect their own drafts; viewers cannot mutate.
- Campaign details show provider-attempt and logical agent-call counts.
- Static writing templates are labelled as shortcuts, not pretend AI calls.
- Source inputs request pasted content; arbitrary source URLs are not fetched.
- Integrations/help copy accurately explains destinations, authentication,
  scheduler requirements and invitation prerequisites.

## Verification performed locally

- `npm test`: 78 passing tests, no failures/skips.
- `npm run test:images`: 38 assertions pass across landscape, portrait,
  EXIF-rotated inputs and invalid data.
- `npm run lint`: passes with no errors or warnings.
- `npm run typecheck`: passes.
- `SKIP_ENV_VALIDATION=1 npm run build`: production build passes without
  database credentials or provider keys.
- `git diff --check`: passes (Git may print Windows CRLF conversion notices).
- Migration generation reports no additional schema changes after `0007`.

The auth coverage tests inspect route guard contracts; they are not substitutes
for authenticated cross-workspace HTTP tests. UI checks include server-rendered
markup and pure helpers, not browser-driven end-to-end interactions.

## Not executed here

There is no configured database URL, local environment file, or Docker executable.
Consequently, real-Postgres tests, applying migration `0007`, container builds,
volume persistence, OAuth/account provisioning, actual generation, real posts,
scheduled-provider delivery and interactive browser QA were not executed.
No existing credentials were requested or read, and no real data was changed.

GitHub Actions configuration now runs unit/lint/types/image/secret-free build
checks, both Docker targets, and migrations/concurrency tests against an isolated
Postgres service. These jobs have not run because the changes are not pushed.

## Decisions and deviations from the original plan

- Scheduler: dedicated PM2 worker or Compose service; the web server alone does
  not publish scheduled content. Shutdown stops starting new due items and gives
  in-flight work up to 120 seconds before process-manager termination.
- Platforms: LinkedIn publishes to LinkedIn; X-format posts publish to Bluesky.
  Instagram/Threads remain copy/image export, and Facebook remains disabled.
  Provider is stored on each durable attempt rather than a duplicate draft field.
- Invitations: implemented a seven-day, hashed, email-bound, single-use link flow
  under Integrations instead of deleting invitations. No email delivery/account
  creation service or new dependency was introduced. Recipients need an existing
  matching Supabase Auth account; admins provision that separately.
- Storage: persistent local uploads shared by web/worker. Object storage remains
  out of scope. Runtime uploads, backups, `.env*` and Git metadata are excluded
  from standalone tracing. Next still warns about dynamic filesystem tracing for
  the configurable upload root; build succeeds, but review standalone image size
  before deploying and retain the tracing exclusions.
- Analytics: a bounded maximum-90-day query returns relevant historical draft
  versions/publications for consistent client-side range selection, rather than
  three separate aggregate endpoints. It does not fabricate social impressions
  or publication timestamps for legacy data.
- Existing tests use Node's built-in runner, not the Vitest suite named in the
  historical plan. No test dependency was added.
- Publication failures are conservatively locked for human reconciliation;
  arbitrary automatic retry cannot guarantee exactly-once external side effects.
- Rollback uses reviewed backups and reconciliation, not a destructive automatic
  down migration that would erase publication evidence.

## Release prerequisites

1. Back up Postgres and uploads; review the diff and the generated migration.
2. Configure a dedicated test database, migrate it, then run `npm run test:db`.
3. Complete authenticated workspace/viewer checks and browser interaction QA.
4. Validate Docker targets/volume persistence, or prepare PM2 and shared storage.
5. Configure runtime credentials privately and set `APP_URL` to the actual origin.
   `UPLOAD_DIR`, if set, must be absolute and writable by both processes.
6. Stop old scheduling workers; run `npm run db:migrate` before starting the
   updated web application and worker. Do not set `SKIP_ENV_VALIDATION=1` at runtime.
7. Start both processes, exercise a manually approved post and a scheduled post
   on each configured provider, and verify one external post/one successful ledger
   entry. Exercise reconciliation before enabling unattended scheduling.

See `docs/SHIP.md` for commands and `docs/DATABASE.md` for state/locking semantics.
