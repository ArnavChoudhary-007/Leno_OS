# Digital Distribution OS

A multi-agent system that turns one campaign brief into on-brand,
platform-native social posts: an orchestrator plans the work, platform
agents draft it, a critic agent scores and revises it against a rubric, a
human approves it, and only then does deterministic code publish and start
learning from performance. See `docs/ARCHITECTURE.md` for the full design
and `AGENTS.md` for the hard rules this codebase follows.

This is currently groundwork only — project scaffold, database, schemas,
config, and typed stubs. No agent logic is implemented yet.

## Local setup

Requires [Docker](https://docs.docker.com/get-docker/) for Postgres.

```bash
npm install
cp .env.example .env      # fill in keys as you implement each agent
npm run db:up              # starts Postgres 17 in Docker (docker-compose.dev.yml)
npm run db:migrate         # applies drizzle/ migrations
npm run db:seed            # inserts one demo brand profile
npm run dev                 # http://localhost:3000
```

`GET /api/health` runs a `select 1` against the database and returns
`{ ok: true }` once Postgres is reachable.

## Environment variables

See `.env.example`. Validated at startup by `src/env.ts` (set
`SKIP_ENV_VALIDATION=1` to bypass this, as the Docker build does).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string, must start with `postgres://`. |
| `DB_PASSWORD` | Postgres password used by `docker-compose.yml` in production. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key for the writer model. |
| `GROQ_API_KEY` | Groq API key for the critic model. |
| `WRITER_MODEL` | Writer model id, e.g. a Gemini Flash model. |
| `CRITIC_MODEL` | Critic model id, e.g. a Llama 3.3 70B model. |
| `BLUESKY_HANDLE` | Bluesky handle used for publishing (later). |
| `BLUESKY_APP_PASSWORD` | Bluesky app password (later). |

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript, no emit. |
| `npm run db:up` | Start local Postgres 17 via `docker-compose.dev.yml`. |
| `npm run db:generate` | Generate a Drizzle migration from the schema. |
| `npm run db:migrate` | Apply pending Drizzle migrations. |
| `npm run db:push` | Push the schema straight to the configured database. |
| `npm run db:seed` | Insert the demo brand profile. |
| `npm run db:studio` | Open Drizzle Studio. |

## Deploying

The app runs as a Docker Compose stack (Postgres + a one-shot migration
step + the Next.js app) on a single AWS EC2 instance. See
`docs/ARCHITECTURE.md#deploy-to-ec2` for the full setup, and
`scripts/backup.sh` for the database backup job.

```bash
docker compose up -d --build
```

## Stack

Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui · Drizzle
ORM + drizzle-kit + `postgres` (postgres.js) on PostgreSQL 17 · Vercel AI SDK
(`ai`, `@ai-sdk/google`, `@ai-sdk/groq`) · zod · `@atproto/api` (Bluesky,
later) · Docker Compose on EC2 · npm.
