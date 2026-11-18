# Leno OS

**One campaign brief in, on-brand posts for every channel out.**

Leno OS is a multi-agent content system. You write a single brief; an
orchestrator agent plans the campaign, platform agents write native posts
for LinkedIn, X, Instagram and Threads, a critic agent scores every draft
against a rubric and sends weak ones back for revision, and a human
approves the result. Only then does plain, deterministic code publish it.

Agents never publish. A person always has the final say.

**Publishing support:** LinkedIn publishes to a connected LinkedIn account;
the X-format draft publishes to **Bluesky**, not to X itself. Instagram and
Threads are **export-only**: copy/download the approved content and publish
it yourself. They have no native publishing integration or automatic scheduler.

---

## How it works

```
Brief
  └─▶ Orchestrator ─ Understand → Define goal → Create plan → Select agents
        │
        ├─▶ Platform agents ─ LinkedIn · X · Instagram · Threads
        │       └─ LinkedIn drafts are enriched with live Tavily research
        ├─▶ Creative ─ your photo, or one generated with GPT Image 1.5,
        │              cropped to each platform's feed size
        ├─▶ Critic ─ scores every draft; below 0.8 → revise (max 3 rounds)
        │              still failing → handed to a human
        └─▶ Deliver ─ drafts ready for review
                          │
                   Human approves ─▶ Publish (Bluesky / LinkedIn)
```

**The eight orchestrator phases:** Understand → Define goal → Create plan →
Select agents → Execute → Evaluate → Iterate → Deliver. Every phase writes a
`run_steps` row, so each run can be replayed on the campaign page as a live
pipeline timeline.

**Budgets keep runs predictable.** A campaign uses at least 4 and at most
10 LLM calls (never one call per platform) and stops after 4 minutes. Once
any drafts exist, a run always delivers something, even if a later step
fails.

### The critic

Every draft is scored 0–1 on four weighted criteria:

| Criterion | Weight | Question it asks |
| --- | --- | --- |
| Brand voice | 30% | Does it sound like the brand's tone, do's and example posts? |
| Goal fit | 25% | Does it serve the goal and land the key message? |
| Craft | 25% | Is it well written? |
| Platform fit | 20% | Is it native to that platform, not a generic repost? |

A draft passes at a weighted score of **0.8** *and* only if it clears the
hard gates the model can't overrule: platform character limits, banned
terms and platform-specific rules. Drafts that fail get a fix list and are
revised, up to **3 rounds**, then escalated to a human.

### Platforms

| Platform | Status | Character limit | Image size |
| --- | --- | --- | --- |
| LinkedIn | ✅ Enabled | 3,000 | 1200×627 (1.91:1) |
| X | ✅ Enabled | 280 | 1600×900 (16:9) |
| Instagram | ✅ Enabled | 2,200 | 1080×1350 (4:5) |
| Threads | ✅ Enabled | 500 | 1080×1350 (4:5) |
| Facebook | ⏸️ Planned | — | — |

**Publishing:** approved LinkedIn drafts post to the workspace's connected
LinkedIn account (OAuth). X-format drafts publish through Bluesky. Instagram
and Threads are export-only; Facebook remains disabled.

**Instagram specialist:** captions, explicitly requested carousels and story
scripts share the existing writer/critic loop. Deterministic checks cover
hooks, hashtags, emoji, carousel structure and story sticker instructions.
Carousel slides export as authenticated 1080 x 1350 JPEGs; Copy caption and
Copy script keep caption text and creative instructions separate. Stories
require native assembly and interactive stickers in Instagram. See
`docs/INSTAGRAM_SPECIALIST.md` for integration details.

---

## Features

- **Brand memory:** one brand profile (positioning, audience, tone, do's
  and don'ts, colours, example posts) is shared by every agent.
- **Campaign builder:** write a brief or load a sample, pick channels, run.
- **Live pipeline view:** watch plan → strategy → draft → critique →
  revise as it happens.
- **Human approval:** approve, edit (creates a new version) or reject with
  a note that the agents use to revise.
- **Images:** upload a photo or let GPT Image 1.5 make one, then get it
  auto-cropped per platform. Branded quote cards and carousel slides are
  rendered with `next/og`; explicit Instagram carousel slides use branded SVGs
  rasterized by the existing `sharp` dependency.
- **Workspaces and roles:** invite-only teams with owner, admin, editor and
  viewer roles.
- **Public demo mode:** a single setting that skips sign-in for judges and
  demos (see [below](#public-demo-mode)).
- **Guard rails:** per-user and per-workspace rate limits, zod validation
  on every LLM response, and row-level security on every table.

### App pages

| Page | What it's for |
| --- | --- |
| `/` | Dashboard |
| `/campaigns/new` | Write a brief and start a run |
| `/campaigns` · `/campaigns/[id]` | Campaign list · pipeline timeline, drafts, critic notes, approval |
| `/brand` | Edit the shared brand profile |
| `/agents` | What each agent does and its latest activity |
| `/track` · `/analytics` | Content lifecycle and output overview |
| `/integrations` | Connect LinkedIn, see Bluesky status |
| `/help` | How Leno OS works |

---

## Tech stack

- **App:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, shadcn/ui
- **AI:** Vercel AI SDK. Writer: Gemini (`@ai-sdk/google`). Critic: Groq (`@ai-sdk/groq`). Images: OpenAI GPT Image 1.5. Research: Tavily
- **Data:** Supabase Postgres via Drizzle ORM + `postgres` (postgres.js). No Supabase client is used for data
- **Auth:** Supabase Auth (email + password, invite-only)
- **Publishing:** `@atproto/api` (Bluesky), LinkedIn Share API
- **Validation:** zod for every schema and every model output
- **Deploy:** one AWS EC2 instance running PM2. Docker Compose is optional

---

## Getting started (local)

**Requirements:** Node.js 22+, npm, a free [Supabase](https://supabase.com/)
project, and API keys for Gemini and Groq.

```bash
git clone https://github.com/ArnavChoudhary-007/Leno_OS.git
cd Leno_OS
npm install
cp .env.example .env        # then fill in the values (see below)

npm run db:migrate          # create the tables
npm run db:seed             # load the demo brand, Loopwave Audio
npm run bootstrap-owner -- --email=you@example.com --password=YourPassword

npm run dev                 # http://localhost:3000
```

In a second terminal, after applying migrations, start `npm run scheduler`.
The web server alone does not deliver scheduled drafts. The worker polls
every 30 seconds and drains its current work on SIGINT/SIGTERM.

Check it's alive: `GET /api/health` returns `{ "ok": true }`.

> **Loopwave Audio** is a fictional brand used for demos. Edit it on
> `/brand` or replace it with your own.

---

## Environment variables

All variables are in `.env.example` and validated at startup by
`src/env.ts`. Set `SKIP_ENV_VALIDATION=1` for CI or Docker builds that
compile without secrets.

`SKIP_ENV_VALIDATION=1` is **build/test only**; do not set it for the app,
CLI publishing commands, or scheduler. During `next build` only, a missing
`DATABASE_URL` uses an inert loopback URL without connecting to a database.
At runtime a missing database URL still fails. Real deployments need the
required variables below in both the web process and scheduler.

### Required

| Variable | What it is |
| --- | --- |
| `APP_URL` | Public address of the app, e.g. `http://localhost:3000` or `http://<server-ip>:3000`. Used for redirects and OAuth callbacks. |
| `SUPABASE_URL` | Supabase project URL, `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret / service-role key. **Server only; never commit or expose it.** |
| `DATABASE_URL` | Supabase **Session pooler** URI (port `5432`, host `aws-0-<region>.pooler.supabase.com`) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini key for the writer |
| `GROQ_API_KEY` | Groq key for the critic |
| `WRITER_MODEL` | e.g. `gemini-3.5-flash-lite` |
| `CRITIC_MODEL` | e.g. `openai/gpt-oss-20b` |

### Optional

| Variable | What it enables |
| --- | --- |
| `OPENAI_API_KEY`, `IMAGE_MODEL`, `IMAGE_SIZE` | Image generation when no photo is uploaded (`gpt-image-1.5`, `1024x1024` only) |
| `UPLOAD_DIR` | Campaign originals and fitted images; defaults to `./uploads`. Use the same persistent, writable directory for the web process and scheduler; Compose sets `/app/uploads` on a shared named volume. |
| `TAVILY_API_KEY` | Live web research for LinkedIn drafts (skipped if unset) |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Connect LinkedIn and publish to it. Redirect URL: `{APP_URL}/api/integrations/linkedin/callback` |
| `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` | Publish to Bluesky |
| `PUBLIC_DEMO` | `1` turns off sign-in (see [Public demo mode](#public-demo-mode)) |
| `DEMO_PASSWORD` | Password for `npm run bootstrap-demo-users` |

### Database URL: common mistakes

- Replace **both** `[YOUR-PASSWORD]` and the square brackets with your real password.
- Use the **Session pooler** host (`...pooler.supabase.com:5432`), **not**
  `db.<ref>.supabase.co`. That host is IPv6-only and usually fails to
  resolve on cloud servers.
- Avoid `@ # / :` in the database password, or URL-encode them.
- Each variable should appear **once** in `.env`: when a name repeats, the
  last line wins.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build / server |
| `npm run lint` · `npm run typecheck` · `npm run test` | Quality checks |
| `npm run test:db` | Database query tests (needs a live `DATABASE_URL`) |
| `npm test` | Portable Node test runner; discovers `src/**/*.test.ts`, excluding `src/db/**`; no credentials or database required |
| `npm run test:images` | Synthetic image fixtures checked against the active creative fitter and platform specs |
| `npm run scheduler` | Run the scheduled-publishing worker; migrate first, keep dependencies including `tsx` installed |
| `npm run db:migrate` | Apply migrations in `drizzle/` |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:seed` | Load the Loopwave demo brand |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run bootstrap-owner -- --email=… --password=…` | Create the first owner login |
| `npm run bootstrap-demo-users` | Create owner/admin/editor/viewer demo logins (`@example.com`) |
| `npm run campaign:test` | Run a full campaign against the live models |
| `npm run context:print` | Print the brand card the agents see |
| `./scripts/deploy.sh` | Install → migrate → build → start/reload in PM2 → health check |

---

## Deploying to AWS EC2

The recommended path is one small EC2 instance running PM2, with the
database on Supabase. The full checklist is in [`docs/SHIP.md`](docs/SHIP.md).

**1. Prepare the server** (Ubuntu, Node 22):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo npm i -g pm2
```

**2. Get the code and configure it:**

```bash
git clone https://github.com/ArnavChoudhary-007/Leno_OS.git
cd Leno_OS
cp .env.example .env && nano .env
echo "APP_URL=http://$(curl -s http://checkip.amazonaws.com):3000" >> .env   # if APP_URL isn't set
mkdir -p ~/leno-uploads
# Set UPLOAD_DIR=/home/ubuntu/leno-uploads in .env (adjust for your user).
```

**3. Set up the database and deploy:**

```bash
npm install
npm run db:migrate
npm run db:seed
npm run bootstrap-owner -- --email=you@example.com --password=YourPassword
./scripts/deploy.sh          # ends with: OK — {"ok":true}
pm2 startup                  # run the sudo line it prints
pm2 save
```

**4. Open the port** in the instance's security group:

| Type | Port | Source |
| --- | --- | --- |
| SSH | 22 | Your IP, or `0.0.0.0/0` if you use EC2 Instance Connect in the browser |
| Custom TCP | 3000 | Your IP (private) or `0.0.0.0/0` (public demo) |

Never open port 5432.

**5. Tell Supabase the address:** Authentication → URL Configuration →
Site URL = your `APP_URL`, and add `{APP_URL}/auth/callback` to Redirect URLs.

**Updating later:**

```bash
cd ~/Leno_OS && git pull && ./scripts/deploy.sh
```

> The public IP changes whenever the instance is stopped and started.
> Attach an **Elastic IP** to keep a fixed address, or update `APP_URL` and
> redeploy after each restart.

---

## Scheduled publishing and recovery

Apply `npm run db:migrate` **before starting either production process**.
PM2 starts `leno-os` and `leno-os-scheduler`; `scripts/deploy.sh` starts or
reloads both. Keep a full `npm ci` install: the scheduler runs TypeScript
through `tsx` and needs `scripts/`, `src/`, and `tsconfig.json`, not just
Next's standalone output. Run one scheduler process per deployment.

`docker compose up -d --build` runs the one-shot migration service first,
then starts the standalone web image and the separate `worker` image. Both
run as the non-root `node` user and share the writable `uploads` volume at
`/app/uploads`. That volume survives rebuilds and ordinary `down`; do not
use `docker compose down -v` unless intentionally deleting uploaded media.
Back up uploads separately from Postgres. For existing bind mounts, ensure
UID/GID 1000 can write before starting the services.

Only human-approved drafts on supported publishers can be scheduled.
Keep provider credentials available to the worker: LinkedIn OAuth client
configuration and a connected account, or the Bluesky handle/app password.
The worker uses the same database, `PUBLIC_DEMO`, and media directory as
the web process. In `PUBLIC_DEMO=1`, both immediate and worker publishing
must remain disabled; do not run a non-demo worker against a demo database.

A timeout or crash after contacting a provider can leave the publication
outcome **unknown**. Do not blindly retry it: an operator must inspect the
provider account, compare the content/time, and reconcile the saved
publication state and provider URL/ID before deliberately retrying. A
database transaction cannot undo a post that a remote provider accepted.

## Public demo mode

For hackathon judging or live demos, set this in `.env` and redeploy:

```
PUBLIC_DEMO=1
```

- **No sign-in.** Every visitor goes straight in as a shared editor of the
  demo workspace, and can create and run campaigns and review drafts.
- **Publishing is blocked,** so visitors can't post to your real accounts.
- **Connecting or disconnecting LinkedIn is blocked.**
- **Spend is capped,** because all visitors share one user: 10 campaigns and
  20 generated images per hour in total.

Run `npm run db:seed` first so there's a brand to work with. Remove the line
(or set it to `0`) and redeploy to require sign-in again. Setting a
spending limit in your OpenAI, Google AI and Groq dashboards is still
recommended while the URL is public.

---

## Roles

| Role | Read | Create, edit, approve, publish | Invite, load demo brand |
| --- | :---: | :---: | :---: |
| Viewer | ✅ | — | — |
| Editor | ✅ | ✅ | — |
| Admin | ✅ | ✅ | ✅ |
| Owner | ✅ | ✅ | ✅ |

---

## Security

- **Agents never publish.** Only code in `src/tools/social/` publishes, and
  only drafts a human has approved.
- **Every LLM response is validated** with a zod schema before it's used.
- **Row-level security** is enabled on every table with no policies, so
  Supabase's public API can't read app data. The server connects directly.
- **Secrets stay on the server.** `DATABASE_URL` and the service-role key
  are never sent to the browser, and `.env` is git-ignored.
- **Rate limits** on sign-in, campaign creation, draft edits, image
  generation and research.

---

## Project structure

```
src/
  app/              Pages and API routes (Next.js App Router)
  agents/           Orchestrator, strategy, critic, one module per platform
  creative/         Image fitting, quote cards, carousel slides
  tools/            LLM registry, OpenAI images, Tavily, Bluesky & LinkedIn publishing
  workflows/        Background campaign runs, publishing an approved draft
  memory/           Loads the brand context every agent shares
  db/               Drizzle schema, queries, seed data
  auth/  authz/     Sign-in, workspace context, role permissions, public demo mode
  shared/           All zod schemas, inferred types, error codes
drizzle/            SQL migrations
scripts/            Deploy, seed and verification scripts
docs/               Architecture, database design, ship checklist
```

## Further reading

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): system design
- [`docs/DATABASE.md`](docs/DATABASE.md): schema and data lifecycle
- [`docs/SHIP.md`](docs/SHIP.md): deploy checklist and 2-minute demo script
- [`AGENTS.md`](AGENTS.md): rules for AI coding tools working in this repo
