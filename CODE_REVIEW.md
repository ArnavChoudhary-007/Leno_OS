# Code review — loose ends, dead code, and slop

Date: 2026-09-19 · Scope: whole repo excluding `node_modules`, `.next`, `.git`.
Method: reference counting on every exported symbol, grep for stubs/TODOs/duplication,
and reading the pipeline end to end. Every finding below has a file:line.

Counts: **5 correctness risks · 3 data-model loose ends · 8 dead-code items ·
6 slop items · 7 config/doc drift items · 3 unverified areas.**

> **Status, 19 Sep 2026:** sections **C (dead code)** and **D (slop)** are fixed —
> see "Resolved" at the bottom. Sections A, B, E and F are still open.

Honest note: most of this is mine. The pipeline landed in one pass and it shows —
speculative helpers nobody calls, stubs kept alive with `void` statements, and
schemas that no longer describe the data.

---

## A. Correctness risks

**A1 — Drafts are matched to DB rows by array position.**
`src/agents/orchestrator/index.ts:96-97` and `:137-138` do `rows[index]` against
`drafted.object.entries()`. This assumes `INSERT ... RETURNING` hands rows back in
input order. Postgres does that today for a multi-row `VALUES`, but it is not
guaranteed by the standard, and nothing in the code would catch a mismatch — a
critique would simply be written onto the wrong platform's row.
*Fix: build a `Map<PlatformId, row>` from the returned rows and look up by platform.*

**A2 — The env contract no longer matches what the app needs.**
`src/env.ts:23-28` still marks `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`,
`WRITER_MODEL` and `CRITIC_MODEL` as `.optional()`, with the comment "Required once
agents/tools/llm.ts is used" (`:22`). They *are* used now. Observed consequence: a
run with no keys boots fine, accepts the POST, returns `202`, and only fails deep
inside the orchestrator with `WRITER_MODEL is not set` — recorded as a failed
campaign. That is precisely the failure mode `env.ts` was written to prevent.
*Fix: make the four required, or validate them at the entry to `runCampaign` and
reject the POST with a clear 400.*

**A3 — `fix_list` cap: schema says 5, code writes up to 10.**
`src/shared/schemas.ts:172` declares `.max(5)`; `CritiqueSchema` inherits it via
`.extend()`. `src/agents/critic/index.ts:131` builds `[...gate_failures,
...llm.fix_list].slice(0, 10)`. Nothing re-parses the final `Critique`, so this
never throws — the schema is simply wrong about its own data, which undercuts the
"schemas are the source of truth" rule.
*Fix: either raise the cap on the final schema or keep gates out of `fix_list`
(they already live in `gate_failures`).*

**A4 — A model that skips a platform looks like a bad post, not a failure.**
`dedupeByPlatform` (`src/agents/platforms/draft.ts:110-118`) silently drops any
platform the writer omitted, and `src/agents/critic/index.ts:117-123` defaults a
missing critique to all-zero scores. A partial response therefore scores 0.0,
burns all three revision rounds, and lands in `needs_human` with no indication that
the model never returned anything.
*Fix: if the returned platform set ≠ requested set, log it as a distinct condition.*

**A5 — A campaign can get stuck in `running` forever.**
`src/agents/orchestrator/index.ts:52` refuses to run anything not in `queued`
(correct — it stops double runs), but if the process dies mid-run the row stays
`running` and can never be retried. There is no timeout, heartbeat or reset path.
*Fix: a `started_at` column plus a "reclaim runs older than N minutes" query.*

---

## B. Data-model loose ends

**B1 — Hashtags are not persisted as data.** `src/db/schema.ts` has no `hashtags`
column, so `composePost()` flattens tags into `body` before insert
(`orchestrator/index.ts:86`). The structured `Draft.hashtags` only exists in memory
for the length of one run. Revising after a restart, or ever editing tags in a UI,
is impossible without re-parsing text.

**B2 — `campaigns.goal` and `campaigns.plan` hold the same object.**
`src/db/queries/campaigns.ts:38` writes `{ goal: plan, plan }`. Two jsonb columns,
one value. The `goal` column is typed `Plan | null` (`src/db/schema.ts:67`), which
is why it happened; it should either hold the goal statement or be dropped.

**B3 — Status values defined twice.** Zod enums at `src/shared/schemas.ts:20-34`
and plain const arrays at `src/db/schema.ts:19-33`. Adding a status means editing
both, and nothing fails if you forget.
*Fix: derive the db arrays from the zod enums (`CampaignStatusSchema.options`).*

---

## C. Dead code (zero callers — verified by reference count)

| Item | Location | Note |
| --- | --- | --- |
| `newId()`, `nowIso()` | `src/shared/utils.ts:4,9` | Whole file unused. Ids come from `$defaultFn`, timestamps from `new Date().toISOString()`. |
| `getWriterModel()`, `getCriticModel()` | `src/tools/llm.ts:35,40` | Orphaned when `generateStructured` started building models internally. |
| `getLatestDraftForPlatform()` | `src/db/queries/drafts.ts:69` | Written speculatively, never called. |
| `buildBrandPacket()` | `src/agents/brand/index.ts:10` | Throws. Superseded by `buildBrandCard()`; the whole module is orphaned. |
| `research()` | `src/agents/research/index.ts:13` | Returns empty notes; not wired into the pipeline. |
| `CritiqueSetSchema` / `CritiqueSet` | `src/shared/schemas.ts:188`, `types.ts:44` | Type-only; never parsed. The pipeline uses `CritiqueLLMSetSchema`. |
| `public/*.svg` (5 files) | `public/` | create-next-app leftovers, referenced nowhere. Includes `vercel.svg`. |
| `/api/og` | `src/app/api/og/route.tsx` | Placeholder image route nothing links to. |

---

## D. Slop

**D1 — Fake implementation kept alive by `void`.**
`src/tools/social/bluesky.ts:17-20`:
```ts
void text; void env.BLUESKY_HANDLE; void env.BLUESKY_APP_PASSWORD; void AtpAgent;
```
The `AtpAgent` import exists only so the file looks wired up, and the `void`s exist
only to silence the resulting unused warnings. The honest stub is three lines with
no imports. Its doc comment also points at `workflows/campaign-run.ts` (`:11`),
which contains no publish path.

**D2 — A gate that cannot fire.** `src/agents/platforms/index.ts:71-73` checks
`playbook.requiresImage && !text.trim()`. The critic only calls it with composed
post text, which is never empty. Instagram's actual "needs an image" rule is
unenforceable because drafts have no image field — so this reads as coverage that
does not exist.

**D3 — The form/action contract is declared twice.** `LIST_FIELDS` at
`src/app/brand/actions.ts:14` and again at `src/app/brand/brand-form.tsx:17`. If
they drift, fields silently stop saving.

**D4 — "5 example posts" hardcoded in three places.**
`src/app/brand/brand-form.tsx:16`, `src/shared/schemas.ts:51`, `:88`.

**D5 — Indirection nobody uses.** `src/lib/utils.ts:1` re-exports `cn` from the
`cn` package, but `src/components/ui/button.tsx:3` imports from `"cn"` directly.
Two ways to do one thing.

**D6 — Comments narrating the obvious.** e.g. the `src/env.ts:1-13` header explains
what zod validation is; `src/app/brand/field.tsx:32-36` exports `inputClass` /
`textareaClass` as string constants instead of components, which is styling by
copy-paste with extra steps.

---

## E. Config and doc drift

| # | Item | Evidence |
| --- | --- | --- |
| E1 | README says the project has no agent logic — now false | `README.md:10-11` |
| E2 | Same stale claim in the env header | `src/env.ts:6-8` |
| E3 | `WRITER_MODEL=gemini-1.5-flash` is a retired model id | `.env.example:10` |
| E4 | `DATABASE_URL ?? ""` turns a missing var into a confusing driver error | `drizzle.config.ts:9` |
| E5 | AGENTS.md rule 5 ("prefer a typed stub with a TODO") now actively works against cleanup | `AGENTS.md:67` |
| E6 | `shadcn` (a CLI) sits in `dependencies`, not `devDependencies` | `package.json:33` |
| E7 | `@atproto/api` is a real dependency used only by a dead stub | `package.json:22` |

---

## F. Unverified — no evidence either way

- **The entire LLM path has never run.** No API keys in this environment, so
  `generateStructured`'s cross-provider fallback, Gemini's tolerance for the
  `DraftSet` / `PlatformNotes` schemas, and the revise→re-critique loop are all
  unproven. The pipeline is verified only up to the point where it calls a model.
- **The production Docker stack has never been built or run** (no Docker here).
- **`scripts/backup.sh` has never been executed.**
- **There are no tests and no CI.** `weightedScore`, `hardGates`, `composePost` and
  `dedupeByPlatform` are pure functions and would be cheap to pin down.

---

## Fix list, in order

1. A2 — make the LLM env vars required (or fail the POST). Stops silent 202s.
2. A1 — match drafts to rows by platform, not array index.
3. A3 — reconcile `fix_list` cap with `CritiqueSchema`.
4. B1 — add a `hashtags` jsonb column and stop flattening into `body`.
5. C — delete the dead code in one sweep (`shared/utils.ts`, `agents/brand`,
   `agents/research`, the two model getters, `getLatestDraftForPlatform`,
   `CritiqueSetSchema`, `public/*.svg`).
6. D1/D2 — reduce `bluesky.ts` to an honest stub; drop the no-op image gate.
7. E1/E2/E3 — update README, the env header, and the model ids.
8. A4/A5 — surface partial model responses; add run reclamation.
9. B2/B3/D3/D4 — de-duplicate `goal`/`plan`, status enums, `LIST_FIELDS`, the 5.
10. F — add unit tests for the pure functions, then run the live pipeline.

---

## Resolved — 19 Sep 2026

**Section C, dead code — all 8 deleted.** `src/shared/utils.ts`, `src/agents/brand/`,
`src/agents/research/`, `src/app/api/og/`, the two model getters in `tools/llm.ts`,
`getLatestDraftForPlatform`, `CritiqueSetSchema` + its type, and the five template
SVGs in `public/`. (`public/.gitkeep` keeps the directory, because the Dockerfile
copies it at `Dockerfile:23`.)

**Section D, slop — all 6 addressed.**
- `bluesky.ts` is now an honest stub: no `@atproto/api` import kept alive by `void`,
  no dangling cross-reference. It says what it will do when built.
- The Instagram gate that could never fire is gone, replaced by a note saying why the
  real check has to wait for image production.
- `LIST_FIELDS` now lives once, in `src/app/brand/fields.ts`, imported by both the
  form and the action. It needed its own module — a `"use server"` file may only
  export async functions.
- `EXAMPLE_POST_COUNT` in `shared/schemas.ts` replaces the number 5 in three places.
- `button.tsx` imports `cn` from `@/lib/utils` like everything else.
- The `src/env.ts` header lost the paragraph explaining what validation is, and with
  it the stale "no agent logic yet" claim.

**Knock-on changes.** `eslint.config.mjs` now treats a leading `_` as "deliberately
unused" — already the convention in server actions and route handlers, but the
default rule only catches trailing arguments. `AGENTS.md` and `docs/ARCHITECTURE.md`
folder maps were corrected so they don't point at deleted modules.

**Still open from this pass:** `@atproto/api` is now imported by nothing at all
(E7) — kept because it is the intended publishing library. `src/app/brand/field.tsx`
still exports `inputClass` / `textareaClass` as strings rather than components (D6);
turning those into components touches form UI that has never been click-tested, so it
was left for a session that can verify it in a browser.
