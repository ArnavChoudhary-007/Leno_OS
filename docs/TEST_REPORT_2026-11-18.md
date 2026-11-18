# Leno OS verification rerun

Date: November 18, 2026. Branch: `bug_fixes`.
Environment: Windows PowerShell, Node.js `v24.14.1`, npm `11.11.0`.

## Verdict

All credential-free automated checks passed. No failing assertion was found in
the executed unit/image suites. This is not an end-to-end or production-readiness
sign-off: database tests could not initialize, runtime configuration is absent,
and live UI/provider/container behavior remains unverified.

This rerun changes only this report. Existing remediation changes remain
uncommitted. No dependencies were installed, migrations applied, accounts
modified, external posts created, or application servers started.

## Executed checks

| Check | Result | What the result establishes |
| --- | --- | --- |
| `npm test` | PASS: 78 tests, 32 suites; zero failed, skipped, or cancelled | Local regression coverage, excluding `src/db/**` by design |
| `npm run test:images` | PASS: 38 assertions | JPEG output dimensions for X, LinkedIn, Instagram and Threads, including portrait and EXIF-rotated inputs |
| `npm run lint` | PASS: exit 0; no warnings/errors | Configured ESLint checks |
| `npm run typecheck` | PASS: exit 0 | Next route type generation and TypeScript compilation |
| `npm run build` with `SKIP_ENV_VALIDATION=1` in that command only | PASS with one warning | Production compilation, static-page generation and standalone output; not configured runtime behavior |
| `git diff --check` | PASS: exit 0 | No whitespace errors in the tracked working diff |
| Configuration smoke assertions | PASS: 3 assertions | Missing configuration fails closed; dummy database initialization is limited to the build phase |
| `npm run test:db` | BLOCKED: exit 1 | Both test files fail during import because required environment variables are absent; database assertions do not execute |
| `npm run test:db` with validation bypassed for this test command only | BLOCKED: exit 1 | Both imports explicitly reject missing `DATABASE_URL`; bypassing general validation does not silently enable a dummy runtime database |

The two failed DB file entrypoints are infrastructure/configuration failures,
not two demonstrated database assertion failures. The validation bypass was
restored after each command and was not used to serve the application.

## What is verified within the test boundary

- Critic scoring, threshold checks, hard gates, post composition, platform
  restrictions, and LinkedIn copy cleanup pass their local regression tests.
- Permission helpers reject viewer mutations. Same-origin validation rejects
  arbitrary localhost origins. Static route-contract checks find authentication
  guards on private routes and the required mutation guards on revise/retry.
- Server-rendered draft cards hide mutation actions for viewers and immutable
  states, display publication errors, reserve reconciliation for admins, and
  expose native publishing only for LinkedIn and X-format posts via Bluesky.
- UI helpers pass editor-remount contract checks, draft-state/read-only checks,
  and consistent analytics date-window/bucketing tests.
- Campaign/invitation input schemas, edited approval/schedule payloads, revision
  claim expiry helpers, model-attempt ceilings, cancellation signals, and
  parallel campaign context isolation pass their covered tests.
- Image fitting, carousel splitting, contrast helpers, prompt construction,
  provider URL construction, retry classification, research formatting and
  safe error formatting pass their covered tests.
- Three additional smoke assertions confirm normal environment validation
  rejects missing settings, the DB client still rejects a missing URL when
  validation is bypassed outside a build, and build-phase DB initialization
  succeeds without making a connection.

These are helper, schema, source-contract and server-rendered checks. They do
not demonstrate successful clicks, network mutations, authenticated requests,
model responses, OAuth, or real social publication.

## What is not working in this local setup

### 1. Database tests and configured runtime are blocked

Only `.env.example` is present; no `.env` or `.env.local` file was found. The
current process has no database, Supabase, writer/critic or social credentials.
The normal DB test command reports missing `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`,
`GROQ_API_KEY`, `WRITER_MODEL`, and `CRITIC_MODEL`.

The scope test and eight integrity tests therefore remain unexecuted. Pending
coverage includes concurrent claims, unique draft versions, edited approval
transactions, workspace isolation, uncertain publication/reconciliation,
stale schedules, invitation acceptance and stale-run fencing. Migration
`drizzle/0007_workflow_integrity.sql` was not applied or validated against a
database during this rerun.

### 2. Build succeeds but retains a filesystem-tracing warning

Next.js reports dynamic filesystem tracing at `src/creative/storage.ts:16`,
where the configurable upload root is joined with workspace/campaign IDs.
The warning says the project can be traced into the deployment output, which
may increase bundle size or include unintended files. Existing tracing
exclusions remain in place; this rerun did not verify the resulting container
contents or artifact-size/security boundary. This is a warning, not a build
failure.

### 3. Docker verification is unavailable

No `docker`, `psql`, or `postgres` executable is available on this shell's PATH.
Docker image builds, Compose startup, migration ordering and shared upload
volume persistence were not exercised. Local checks used Node 24; deployment
and GitHub Actions target Node 22, which was not exercised in this rerun.

## Still unverified, not proven broken

- Browser interactions: editing, approval, schedule/cancel, copy/download,
  revision notes, polling cleanup, navigation, date filters and invitations.
- Authenticated HTTP enforcement across workspaces and viewer/editor/admin
  roles; static route checks cannot replace these tests.
- Generation with real models, research/image APIs, budget enforcement across
  actual provider retries, and recovery during interrupted runs.
- LinkedIn OAuth and publication; Bluesky publication; external failure and
  timeout reconciliation; real scheduled delivery and graceful worker shutdown.
- Invitation acceptance with an existing matching Supabase Auth account.
- Runtime media authorization, persistent storage and production health.

Instagram and Threads remain intentionally export-only; Facebook is disabled.
Passing platform-affordance tests does not add publishing support for these
destinations. Database-less compilation is not a database-less runtime mode.

## Recommended next verification sequence

1. Configure an isolated, disposable Postgres database and apply the migrations
   to that database only. Follow the documented migration procedure.
2. Run `npm run test:db` against that database. As in the CI database job,
   `SKIP_ENV_VALIDATION=1` may be scoped to DB test execution if unrelated
   provider settings are absent; a real `DATABASE_URL` is still required.
3. Configure the real app privately with runtime validation enabled. Run
   authenticated HTTP checks and browser interaction QA using test accounts.
4. Verify the Node 22 Docker targets and shared upload volume, or the PM2 web
   and scheduler processes, and inspect standalone tracing output.
5. Only with deliberate approval, exercise a manual and scheduled test post on
   each supported provider, including ambiguous-outcome reconciliation.

Do not treat the current green local checks as authorization to deploy or
publish. No repair, deployment, commit or push was performed in this rerun.

## Raw logs

Logs from this rerun are stored outside the repository at:

`C:\Users\arnav\AppData\Local\Temp\leno-validation-20261118-072622`

Files: `unit.log`, `images.log`, `lint.log`, `typecheck.log`, `build.log`,
`diff-check.log`, `database.log`, `database-isolated.log`, and
`configuration-smoke.log`. Temporary files may be cleaned by the operating
system; this report preserves the results and interpretation.
