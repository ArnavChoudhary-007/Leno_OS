# Digital Distribution OS

A multi-agent system that turns one campaign brief into on-brand,
platform-native social posts: an orchestrator plans the work, platform
agents draft it, a critic agent scores and revises it against a rubric, a
human approves it, and only then does deterministic code publish.

See `docs/ARCHITECTURE.md` for design, `docs/DATABASE.md` for the schema,
`docs/SHIP.md` for the EC2/PM2 ship checklist, and `AGENTS.md` for hard rules.

**Sprint status:** brand → pipeline → campaign UI → approval → OG images →
Bluesky publish → polish are in. Ship path is PM2 on a single EC2 instance.

## Local setup

Requires a [Supabase](https://supabase.com/) project (Postgres). Drizzle
talks to it over the standard connection URI — no Supabase JS client.

```bash
npm install
cp .env.example .env      # set DATABASE_URL + Supabase + AI keys
npm run db:migrate         # Session/Direct URI for migrations
npm run db:seed            # Loopwave demo brand
npm run dev                 # http://localhost:3000
```

`GET /api/health` → `{ "ok": true }` once Supabase is reachable.

## Environment variables

See `.env.example`. Validated at startup by `src/env.ts` (set
`SKIP_ENV_VALIDATION=1` for Docker/CI builds that compile without secrets).

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL (`https://[ref].supabase.co`). |
| `SUPABASE_ANON_KEY` | Supabase anon (public) API key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (server only; never expose to the browser). |
| `DATABASE_URL` | Postgres URI. Session/Direct for migrations; pooler fine for the app. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key for the writer (**required**). |
| `GROQ_API_KEY` | Groq API key for the critic (**required**). |
| `WRITER_MODEL` | e.g. `gemini-3.5-flash-lite` (**required**). |
| `CRITIC_MODEL` | e.g. `openai/gpt-oss-20b` (**required**). |
| `BLUESKY_HANDLE` | Bluesky handle (optional until you publish). |
| `BLUESKY_APP_PASSWORD` | Bluesky app password (optional until you publish). |

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Next.js dev server. |
| `npm run build` | Production build. |
| `npm run start` | Production server (used by PM2). |
| `npm run lint` / `typecheck` / `test` | Quality gates. |
| `npm run db:migrate` | Apply Drizzle migrations to Supabase. |
| `npm run db:seed` | Upsert the demo brand. |
| `npm run campaign:test` | End-to-end campaign against live models. |
| `./scripts/deploy.sh` | `npm ci` → migrate → build → PM2 reload + health check. |

## Deploy (PM2 on EC2) — preferred

One `t4g.small` (ARM) + Node 22 + PM2. Database stays on Supabase.

```bash
# on the instance, after cloning and filling .env:
npm run db:migrate && npm run db:seed
./scripts/deploy.sh
pm2 startup && pm2 save
```

Full checklist and demo script: **`docs/SHIP.md`**.

Optional Docker path: `docker compose up -d --build` (see `docker-compose.yml`).

## Stack

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui · Drizzle +
`postgres` on Supabase · Vercel AI SDK (`@ai-sdk/google`, `@ai-sdk/groq`) ·
zod · `@atproto/api` (Bluesky) · PM2 on EC2 · npm.
