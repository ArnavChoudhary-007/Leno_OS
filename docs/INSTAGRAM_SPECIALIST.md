# Instagram specialist integration

Integrated on `bug_fixes` on November 18, 2026, using the specialist additions
from `cd09077` on `origin/feat/instagram-agent`. This is a selective code port,
not a merge or pull of that branch. Existing workflow integrity, publication,
scheduler, workspace and deployment fixes are retained.

## Included

- Instagram playbook and prompt knowledge for caption hooks, scannable copy,
  relevant hashtags, carousel structure, and story sticker instructions.
- Mechanical sanitization after both initial drafting and revision, including
  human-requested revisions through the shared writer path.
- Shared critic hard gates for Instagram, with no fabricated scores or separate
  agent loop. Banned claims are checked across the full creative script, not
  only the composed caption.
- Optional `instagram_format` in the shared plan schema: `caption`, `carousel`,
  or `story`. Historical plans without it remain valid. The planner selects
  carousel/story only when requested in the brief; the writer receives the
  format explicitly, and the critic rejects a requested format without markers.
- Explicit carousel slides rendered as branded 1080 x 1350 JPEGs. Caption-only
  drafts retain existing photo fitting and generic quote/carousel fallbacks.
- Carousel thumbnails and links on campaign cards and in the editor, even when
  a fitted campaign photo exists. Story scripts remain visible as numbered text.

## How to use

Select Instagram and request the desired format in the brief, for example
"Make a six-slide Instagram carousel about our onboarding checklist" or
"Write an Instagram story sequence with a poll sticker". With no explicit
format request, the planner is instructed to choose a plain caption.

Carousels store one complete slide per `Slide N:` line after the caption.
Stories store one complete frame per `Story N:` line. `composePost()` removes
these marker lines when composing the caption. Campaign cards offer separate
Copy caption and Copy script buttons. Script export and the editor's Copy draft
and script action use `composeDraftExport()`, preserving the caption, full
slide/story script and hashtags. The editor's caption counter includes hashtags
but excludes script lines. Human edits are not silently rewritten by the
sanitizer.

The imported editorial policy uses up to five unique hashtags, a 125-character
hook, at most five caption emoji, five to ten carousel slides, and at most
thirty words per slide with a final CTA. These are this application's quality
rules, not a statement that every number is a current external API limit.

## Security and compatibility

No Python daemon, canned fallback, provider credentials, new dependencies,
database columns, or migrations were added. The old branch's image storage
helpers and campaign/latest-draft slide route were not restored.

Exports reuse `/api/og/carousel?draftId=<uuid>&slide=<zero-based-index>`, which
authenticates, validates exact query values, and looks up that specific draft
inside the active workspace. This avoids showing a different draft version's
slides. Unpublished creative responses use `Cache-Control: private, no-store`.
SVG text is XML-escaped and color attributes are normalized or replaced with
safe defaults. The handler remains on the Node.js runtime.

Native publication and scheduling remain limited to LinkedIn and X-format posts
via Bluesky. Instagram is export-only. Story sticker text is an instruction for
the human assembling the story in Instagram; the app does not create interactive
stickers or publish stories. Agents never publish.

## Verification boundary

Regression coverage includes the source branch's specialist/parser/renderer
tests plus local integration cases for shared prompts and critic gates, plan
compatibility, script-preserving copy, strict export parameters, private scoped
route contracts, rendered card affordances and actual JPEG rasterization.
Writer/revision wiring and route security checks include static source-contract
tests, not authenticated HTTP or live-model tests.

Final local checks on November 18, 2026:

- `npm test`: 151 tests pass in 43 suites, with zero failures or skips.
- `npm run test:images`: all 38 assertions pass.
- `npm run lint` and `npm run typecheck`: pass.
- `SKIP_ENV_VALIDATION=1 npm run build`: passes; the bypass is scoped to that
  build command, not application runtime.
- `git diff --check` and whitespace checks on new files: pass.
- Existing DB queries, workflow integrity, scheduler, migrations, deployment
  files and dependency manifests have no changes from this selective port.

Real model generation, authenticated cross-workspace HTTP requests, browser
interactions, database integration and native manual publication require
configured test infrastructure and have not been exercised by this integration.
The pre-existing dynamic filesystem tracing warning at
`src/creative/storage.ts:16` remains; production compilation succeeds.

Raw local logs are under
`C:\Users\arnav\AppData\Local\Temp\leno-instagram-20261118-150820`.
No commit, push, deployment or real platform publication was performed.
