# Leno OS Remediation Plan

Date: 2026-11-16
Status: Historical execution plan. Implementation is now in the `bug_fixes`
working tree. See `docs/REMEDIATION_RESULTS.md` for changes, verification,
decisions, deviations and release prerequisites; infrastructure checks remain.
Source: codebase audit (bugs, dead code, loose ends) performed on 2026-11-16.

This document arranges every finding from the audit into a prioritized backlog, groups them into execution phases, and defines the work, verification, and exit criteria for each phase. Phases are ordered so each one removes risk that later phases would otherwise build on.

---

## 1. Finding Inventory

Severity scale: P0 = security or data-integrity, fix before any multi-workspace use. P1 = user-visible wrong behavior. P2 = incomplete feature or deployment risk. P3 = hygiene.

| # | Finding | Severity | Area | Primary file(s) |
|---|---------|----------|------|-----------------|
| F1 | Revise and retry endpoints skip workspace authorization, permission checks, and rate limits | P0 | Auth | `src/app/api/drafts/[id]/revise/route.ts`, `src/app/api/campaigns/[id]/retry/route.ts` |
| F2 | Concurrent publish requests create duplicate external posts | P0 | Publishing | `src/workflows/publish-draft.ts` |
| F3 | `claimCampaign()` is read-then-update, not atomic | P0 | Orchestration | `src/db/queries/campaigns.ts` |
| F4 | Reruns insert drafts at `version: 1`, colliding with the unique index; error path can overwrite old draft state | P0 | Orchestration | `src/agents/orchestrator/index.ts`, `src/db/schema.ts` |
| F5 | Scheduling stores a time but nothing ever publishes scheduled drafts | P2 | Scheduling | `src/db/queries/drafts.ts` |
| F6 | Content library picks highest version, including superseded ones | P1 | Queries / UI | `src/db/queries/drafts.ts` (`listWorkspaceLatestDrafts`) |
| F7 | Human revision can supersede published or scheduled drafts | P0 | State machine | `src/agents/orchestrator/revise-with-note.ts`, `src/db/queries/drafts.ts` |
| F8 | Approve and Schedule ignore unsaved editor edits | P1 | UI | `src/components/leno/editor-drawer.tsx` |
| F9 | Schedule route approves before validating the date; edit/reject do not clear `scheduled_at` | P1 | API | `src/app/api/campaigns/[id]/drafts/[draftId]/route.ts` |
| F10 | Instagram and Threads drafts are published through Bluesky and fail its 300-char limit | P1 | Publishing | `src/workflows/publish-draft.ts`, `src/tools/social/bluesky.ts` |
| F11 | Analytics range selector only filters the chart, not the KPIs; source query capped at 200 rows | P1 | Analytics | `src/app/analytics/analytics-view.tsx` |
| F12 | Platform, creativity, and research controls are flattened into brief text, not enforced | P1 | Campaign config | `src/app/campaigns/new/brief-form.tsx`, orchestrator |
| F13 | Four-minute budget is not a hard deadline; LLM call counter counts logical calls, not attempts | P2 | Orchestration | `src/agents/orchestrator/index.ts` |
| F14 | Secret-free Docker build fails: `DATABASE_URL.includes()` on undefined | P2 | Build | `src/db/client.ts`, `Dockerfile` |
| F15 | Docker image uploads are not persisted; runner user may lack a writable upload dir | P2 | Deployment | `docker-compose.yml`, `Dockerfile` |
| D1 | Unused components `workflow-hero.tsx` and `campaigns-table.tsx` | P3 | Dead code | `src/components/workflow-hero.tsx`, `src/app/campaigns/campaigns-table.tsx` |
| D2 | Instagram specialist `generateDraft()` has no callers | P3 | Dead code | `src/agents/platforms/instagram.ts` |
| D3 | Second image-storage system unused, but its serving route is reachable without workspace auth | P1 | Dead code / Auth | `src/lib/images/storage.ts` and its route |
| D4 | `verify-orchestrator.ts` asserts that implemented functions are stubs; large lint contributor | P3 | Dead code | `scripts/verify-orchestrator.ts` |
| D5 | `insertInvite()` has no callers; no owner-facing invite creation flow | P3 | Loose end | `src/db/queries/workspaces.ts` |
| D6 | RLS enabled in migrations but `.enableRLS()` only on platform connections in the Drizzle schema | P2 | Schema drift | `src/db/schema.ts`, `drizzle/` |
| V1 | `npm test` fails on Windows due to POSIX env syntax | P3 | Tooling | `package.json` |
| V2 | ESLint: 26 errors, 12 warnings | P3 | Tooling | repo-wide |

---

## 2. Execution Phases

Each phase is independently shippable. Do not start a phase until the previous phase's exit criteria pass, except where noted as parallelizable.

### Phase 0: Baseline and Safety Net
Goal: make the test and lint loop reliable before touching risky code.

| Step | Work | Covers |
|------|------|--------|
| 0.1 | Make `npm test` cross-platform (use `cross-env` or move env setup into `scripts/load-env.mjs`). | V1 |
| 0.2 | Fix or delete `scripts/verify-orchestrator.ts`. Recommended: delete it and move any still-useful assertions into real unit tests. | D4, part of V2 |
| 0.3 | Clear remaining lint errors so lint can be a CI gate. Warnings may remain. | V2 |
| 0.4 | Write failing tests that reproduce F1, F2, F3, F6, F9 using the isolated reproductions from the audit. These become the acceptance tests for Phases 1 and 2. | — |

Exit criteria: typecheck, lint (errors = 0), and tests all run with one command on Windows and Linux. The new reproduction tests fail for the expected reasons.

Estimated effort: 0.5 to 1 day.

### Phase 1: Authorization
Goal: no endpoint can mutate another workspace's data.

| Step | Work | Covers |
|------|------|--------|
| 1.1 | Wrap revise and retry routes with the same `requireAuthContext()`, workspace-ownership check, editor-permission check, origin check, rate limit, and error envelope used by the newer campaign routes. Extract a shared helper if one does not already exist so future routes cannot skip it. | F1 |
| 1.2 | Either delete the legacy image route from `src/lib/images/storage.ts` or add workspace authorization to it. Recommended: delete, since its helpers have no callers and the active pipeline uses a different layout. | D3 |
| 1.3 | Add a route-coverage test that enumerates every `route.ts` under `src/app/api` and asserts each mutating handler calls the auth helper. | F1 regression guard |
| 1.4 | Reconcile RLS: add `.enableRLS()` to every table the migrations protect, then confirm `drizzle-kit generate` produces an empty diff. | D6 |

Exit criteria: Phase 0.4 auth tests pass. Route-coverage test passes. Drizzle diff is empty.

Estimated effort: 1 day.

### Phase 2: Atomic Claims and Idempotent Publishing
Goal: concurrent requests cannot double-run a campaign or double-post a draft.

| Step | Work | Covers |
|------|------|--------|
| 2.1 | Rewrite `claimCampaign()` as a single conditional `UPDATE ... WHERE id = $1 AND (status = 'queued' OR claimed_at < now() - interval) RETURNING id`. Treat zero rows as "not claimed". | F3 |
| 2.2 | Add a `publications` table (or equivalent columns) recording draft id, attempt id, provider, external post id, and status (`claimed`, `succeeded`, `failed`, `unknown`). | F2 |
| 2.3 | Rewrite `publish-draft.ts`: atomically move the draft from `approved` to `publishing` with a conditional update, insert the attempt row, call the provider, then record the outcome. On provider success plus DB failure, mark the attempt `unknown` and refuse automatic retry until reconciled. | F2 |
| 2.4 | Add a reconciliation path (manual or scheduled) that resolves `unknown` attempts by querying the provider where possible. | F2 |

Exit criteria: Phase 0.4 concurrency tests pass. Two parallel publish calls produce exactly one provider call. Two parallel claims produce exactly one `true`.

Estimated effort: 1.5 to 2 days. Includes one migration.

### Phase 3: Draft Version and State Model
Goal: one consistent definition of "the current draft" and legal state transitions.

| Step | Work | Covers |
|------|------|--------|
| 3.1 | Define the draft state machine explicitly in code: `generated -> under_review -> approved -> scheduled -> publishing -> published`, plus `rejected`, `superseded`, `failed`. Encode allowed transitions in one function and call it from every mutation. | F7, F9 |
| 3.2 | Forbid revision of `published`, `publishing`, and `scheduled` drafts, or require an explicit "unschedule" first. `markOtherVersionsSuperseded` must never touch `published` rows. | F7 |
| 3.3 | Introduce a run identity: add `run_id` to drafts, or compute `next version = max(version) + 1` per campaign+platform inside the insert. Recommended: compute next version inside a transaction so retries and reruns never collide. | F4 |
| 3.4 | In the orchestrator error path, only `deliver()` drafts created by the current run. Never overwrite review or publication state of prior versions. | F4 |
| 3.5 | Add a single `getCurrentDraftVersion` query that excludes `superseded` and is used by the content library, tracking board, analytics, and campaign detail. Replace the highest-version logic in `listWorkspaceLatestDrafts`. | F6 |
| 3.6 | Schedule route: validate the date first, then perform approve+schedule in one transaction. Edit and reject must clear `scheduled_at`. | F9 |

Exit criteria: state-transition unit tests cover every edge. Rerun of a completed campaign succeeds. Library and campaign detail show the same draft for the audit's superseded-v2 / active-v1 fixture. Past-date schedule leaves the draft untouched.

Estimated effort: 2 days. Likely one migration.

### Phase 4: Scheduling Worker
Goal: a scheduled draft actually publishes when its time arrives.

| Step | Work | Covers |
|------|------|--------|
| 4.1 | Decide the execution host: Next.js route hit by an external cron, a PM2 worker process (the repo already has `ecosystem.config.cjs`), or a Postgres-driven poller. Recommended: PM2 worker process polling every minute, since the deploy already uses PM2. | F5 |
| 4.2 | Worker loop: atomically claim due drafts (`status = 'scheduled' AND scheduled_at <= now()` with `FOR UPDATE SKIP LOCKED` or a conditional update), then call the Phase 2 publish workflow. | F5 |
| 4.3 | Retry policy with backoff and a max attempt count. Surface failures in the UI as a `failed` state with the provider error. | F5 |
| 4.4 | Until 4.1 to 4.3 ship, hide or disable the Schedule button so the UI does not promise something that does not happen. This step can ship immediately after Phase 3. | F5 |

Exit criteria: integration test with a fake clock publishes a due draft exactly once across two concurrent workers.

Estimated effort: 1.5 days.

### Phase 5: Publishing Correctness per Platform
Goal: a draft that passes review can actually be published to its target.

| Step | Work | Covers |
|------|------|--------|
| 5.1 | Make the destination explicit on the draft (`target_provider`). Stop routing all non-LinkedIn drafts to Bluesky implicitly. | F10 |
| 5.2 | Validate the draft against the actual destination's limits at approval time, not only at publish time. Reuse the playbook limits already in the repo. | F10 |
| 5.3 | For platforms without a native publisher (Instagram, Threads), either generate a separate Bluesky-length adaptation as its own draft, or mark them "export only" in the UI. Decision needed from product owner. | F10 |

Exit criteria: an approved Instagram draft of 1,000 characters either publishes to a native target or is blocked at approval with a clear message. It never fails silently at publish time.

Estimated effort: 1 to 3 days depending on whether native publishers are built.

### Phase 6: Campaign Configuration and Budget Enforcement
Goal: UI controls do what they say.

| Step | Work | Covers |
|------|------|--------|
| 6.1 | Add a structured `campaign_options` JSON column: `platforms[]`, `creativity`, `research_enabled`. Submit it from the brief form instead of appending text. | F12 |
| 6.2 | Enforce in the orchestrator: platform allowlist, model temperature from `creativity`, skip Tavily when `research_enabled` is false. | F12 |
| 6.3 | Keep the 2,000-character limit on the idea text only, so options are never truncated. | F12 |
| 6.4 | Thread a single `AbortSignal` with a deadline through every agent call, provider retry, research call, and image generation. Check it before each step and abort in-flight requests on expiry. | F13 |
| 6.5 | Track `logical_calls` and `provider_attempts` separately in run metadata; display both. | F13 |

Exit criteria: toggling research off produces zero Tavily calls in a test with Tavily configured. A run with a 1-second deadline aborts within a small margin.

Estimated effort: 1.5 days. One migration.

### Phase 7: Editor and Analytics Correctness
Goal: what the user sees is what gets saved and counted.

| Step | Work | Covers |
|------|------|--------|
| 7.1 | Editor drawer: Approve and Schedule send the current `body` and the server saves-then-transitions in one request. Alternatively disable both buttons while the editor is dirty. Recommended: send the body. | F8 |
| 7.2 | Analytics: move KPI computation into a database aggregate query that takes the selected window. Remove the 200-row cap for aggregates; keep pagination only for the row list. | F11 |

Exit criteria: editing text then clicking Approve persists the edited text. Changing the analytics range changes every number on the page.

Estimated effort: 1 day.

### Phase 8: Deployment Hardening
Goal: the Docker path builds without secrets and survives container replacement.

| Step | Work | Covers |
|------|------|--------|
| 8.1 | Make DB client initialization lazy, or guard it behind `SKIP_ENV_VALIDATION` so the build never dereferences `DATABASE_URL`. Verify the secret-free `docker build` passes. | F14 |
| 8.2 | Add a named volume for the upload directory in `docker-compose.yml`. In the Dockerfile, create the directory and `chown` it to `node` before `USER node`. | F15 |
| 8.3 | Document the upload path and volume in `docs/SHIP.md`. Consider object storage as a follow-up. | F15 |

Exit criteria: `docker build` with no secrets succeeds. `docker compose down && up` preserves a previously uploaded image. Can run in parallel with Phases 5 to 7.

Estimated effort: 0.5 day.

### Phase 9: Dead Code and Loose Ends
Goal: remove misleading code so future work is not built on it.

| Step | Work | Covers |
|------|------|--------|
| 9.1 | Delete `workflow-hero.tsx` and `campaigns-table.tsx` after confirming zero imports. | D1 |
| 9.2 | Either wire the Instagram specialist into the batch writer or delete `generateDraft()` and its aliases. Recommended: delete unless a product decision wants platform specialists. | D2 |
| 9.3 | Remove `src/lib/images/storage.ts` if not already removed in Phase 1.2. | D3 |
| 9.4 | Decide on invitations: either build the owner-facing invite creation UI and email/link flow around `insertInvite()`, or remove `insertInvite()` and the acceptance path together. | D5 |

Exit criteria: no exported symbol in `src/` has zero references, verified with `ts-prune` or equivalent.

Estimated effort: 0.5 to 1 day, plus the invite flow if built (1 to 2 days).

---

## 3. Dependency Graph

```
Phase 0 (baseline)
  └─> Phase 1 (auth)
        └─> Phase 2 (atomic claims, idempotent publish)
              └─> Phase 3 (state model, versions)
                    ├─> Phase 4 (scheduler worker)      ─┐
                    ├─> Phase 5 (per-platform publish)  ─┤
                    ├─> Phase 6 (config, deadline)      ─┼─> Phase 9 (cleanup)
                    └─> Phase 7 (editor, analytics)     ─┘
Phase 8 (deployment) is independent and can run any time after Phase 0.
```

Phases 4 to 7 can run in parallel by different people once Phase 3 lands, since they touch different files. Phase 9 goes last so that cleanup does not conflict with in-flight branches.

---

## 4. Migrations Expected

| Phase | Migration |
|-------|-----------|
| 2 | New `publications` table or publication-attempt columns on drafts |
| 3 | `run_id` on drafts, or no migration if next-version is computed in a transaction |
| 6 | `campaign_options` JSON column on campaigns |
| 1 / D6 | No schema change, but `.enableRLS()` additions must produce an empty diff |

Each migration should ship with a down migration and be applied to a copy of production data before release.

---

## 5. Verification Strategy

- Unit tests: every phase adds tests to the existing Vitest suite. The reproductions from the audit become regression tests in Phase 0.4.
- Concurrency tests: Phases 2, 3, and 4 need tests that run two callers against a real Postgres (Docker or Neon branch), not mocks, because the bugs are in SQL semantics.
- Route coverage: Phase 1.3 adds an automated guard that no API route can ship without authorization.
- Build gate: Phase 8.1 adds a CI job that runs the secret-free Docker build.
- Manual QA after Phase 7: create a campaign, edit a draft, approve, schedule, wait for the worker, confirm one external post and one `published` row.

---

## 6. Summary Timeline

| Phase | Effort (days) | Cumulative |
|-------|---------------|------------|
| 0 Baseline | 0.5 to 1 | 1 |
| 1 Authorization | 1 | 2 |
| 2 Atomic publish and claim | 1.5 to 2 | 4 |
| 3 State model | 2 | 6 |
| 4 Scheduler | 1.5 | 7.5 |
| 5 Platform publishing | 1 to 3 | 8.5 to 10.5 |
| 6 Config and deadline | 1.5 | 10 to 12 |
| 7 Editor and analytics | 1 | 11 to 13 |
| 8 Deployment | 0.5 | 11.5 to 13.5 |
| 9 Cleanup | 0.5 to 3 | 12 to 16.5 |

Single engineer, sequential: roughly 12 to 16 working days. With Phases 4 to 8 parallelized across two people: roughly 8 to 10 working days.

---

## 7. Decisions Needed Before Starting

1. Phase 4.1: scheduler host (PM2 worker recommended).
2. Phase 5.3: build native Instagram and Threads publishers, generate Bluesky adaptations, or mark those platforms export-only.
3. Phase 9.4: build the invitation flow or remove it.
4. Phase 8.3: local volume now, object storage later, or object storage immediately.

Defaults will be used if no answer is given: PM2 worker, export-only for Instagram and Threads, remove invitations, local volume.
