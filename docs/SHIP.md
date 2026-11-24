# Ship checklist

Deploy one web process and one scheduled-publishing worker on EC2, with
Supabase Postgres. PM2 is the native path; Docker Compose is an alternative.

## Pre-flight

- [ ] Node.js 22+ and npm installed; run `npm ci` including dev dependencies.
- [ ] `npm test`, `npm run test:images`, `npm run lint`, and `npm run typecheck` pass.
- [ ] `npm run build` passes without secrets or a validation override.
- [ ] Do not set `SKIP_ENV_VALIDATION=1` for web, worker, or publishing CLI runtime.
- [ ] `.env` contains `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, writer/critic keys, and
      `WRITER_MODEL`/`CRITIC_MODEL`. Share runtime configuration with the worker.
- [ ] Supabase is awake. Use a Session/Direct database URL for migrations;
      the transaction pooler is supported by the running app/worker.
- [ ] Set `UPLOAD_DIR` to persistent storage writable by the service user;
      web and worker must share that same directory.
- [ ] For LinkedIn, configure OAuth client ID/secret and the callback
      `{APP_URL}/api/integrations/linkedin/callback`, then connect an account.
      For X-format drafts, configure `BLUESKY_HANDLE`/`BLUESKY_APP_PASSWORD`.
- [ ] `OPENAI_API_KEY`/`IMAGE_MODEL` enable optional generated images;
      `IMAGE_SIZE` is `1024x1024`. `TAVILY_API_KEY` enables optional research.
- [ ] Security group allows SSH from your IP only and HTTP(S) publicly;
      never expose Postgres port 5432. Configure a reverse proxy and TLS.

No credentials are required to build. A build-only inert database URL
prevents client initialization errors without connecting to Postgres;
runtime configuration remains required. Never bake `.env` into an image.

## Vercel web deployment

1. Import the repository as a Next.js project and build the branch containing
   this fix with `npm run build`. Leave `SKIP_ENV_VALIDATION` unset.
2. In Vercel project settings, configure these environment variables for the
   deployment environment (Production or Preview): `APP_URL`, `DATABASE_URL`,
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `WRITER_MODEL`, and
   `CRITIC_MODEL`. Use the deployed HTTPS origin for `APP_URL` and keep all
   secrets server-only. Optional integrations are listed in `.env.example`.
3. Add `{APP_URL}/auth/callback` to Supabase Auth's allowed redirect URLs and
   set the production Site URL to the production origin.
4. Apply pending migrations separately using the intended database's Session
   or Direct URL; Vercel's build does not apply migrations. Redeploy after
   environment changes, then check sign-in and campaign loading.

A successful Vercel build does not provision the persistent writable upload
directory or the long-running scheduler. The web-only deployment does not
provide durable campaign media or scheduled publishing on its own. Use the
EC2/Compose path below for both features with the current local-storage design.

## First-time EC2 setup (PM2)

Install Node.js 22+, git, and PM2 on the host, then:

```bash
git clone <your-repo-url> Leno_OS
cd Leno_OS
npm ci
cp .env.example .env
# Fill .env privately; do not commit it.
mkdir -p /home/ubuntu/leno-uploads
# Set UPLOAD_DIR=/home/ubuntu/leno-uploads (adjust for the actual service user).
npm run db:migrate
npm run db:seed
# Bootstrap the owner using your normal private credential-entry procedure.
./scripts/deploy.sh
pm2 startup
pm2 save
pm2 status
```

Migrations must complete **before** starting the worker. The deploy script
installs dependencies, migrates, builds, and starts/reloads both `leno-os`
and `leno-os-scheduler`. Do not install with `--omit=dev`: `tsx` is required
by the worker, alongside `scripts/`, `src/`, and `tsconfig.json`.

For local development or a supervised foreground worker, run in a second
terminal after migrations:

```bash
npm run scheduler
# Equivalent:
node --import ./scripts/load-env.mjs --import tsx scripts/scheduler.ts
```

The worker polls every 30 seconds; keep one worker per deployment. It
stops polling on SIGINT/SIGTERM and allows in-flight work to finish. PM2
and Compose allow 120 seconds before forceful termination. The web server
alone does not process scheduled publications.

Health: `curl -fsS http://127.0.0.1:3000/api/health` should return
`{"ok":true}`. Inspect both `pm2 logs leno-os` and
`pm2 logs leno-os-scheduler`; the web health endpoint does not prove worker health.

## Redeploy and migrations

```bash
cd Leno_OS
git pull
./scripts/deploy.sh
```

For schema-changing deployments, stop the existing scheduler before
migrating if the change is not backward-compatible; restart it only after
the new migrations and build succeed.

| Operation | Command |
| --- | --- |
| Generate migration locally | `npm run db:generate`, then include `drizzle/` in the release |
| Apply on Supabase | `npm run db:migrate` with a Session/Direct URL |
| Load demo brand | `npm run db:seed` |
| Database integration tests | `npm run test:db` against a dedicated test database, not production |

## Docker Compose alternative

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 app scheduler migrate
```

The one-shot `migrate` service gates startup of both `app` and `scheduler`.
The app uses the `runner` target (Next standalone); migration and scheduler
use the `worker` target, which includes TypeScript tooling/config/source.
All runtime services run as the non-root `node` user with validation enabled.

App and scheduler mount the same named `uploads` volume at `/app/uploads`.
The image creates that directory owned by `node` (UID/GID 1000), so a new
named volume starts writable. Existing volumes or bind mounts must already
be writable by that user. Rebuilds and ordinary `docker compose down`
preserve uploads; `docker compose down -v` deletes the named volume.
Back up that volume separately from the Supabase database.

`.dockerignore` excludes environment files, upload/storage directories,
backups, private-key files, and local build artifacts. Provide runtime
secrets through `.env`/your deployment environment, never Docker build args.

## Supported publishing and safety

- **LinkedIn:** native publishing through a connected LinkedIn account.
- **X-format drafts:** native publishing to **Bluesky**, not to X itself.
- **Instagram and Threads:** export-only. Copy/download and publish manually;
  these have no native publisher or automatic scheduled delivery.
- A human must approve the current draft before publishing or scheduling.
- `PUBLIC_DEMO=1` blocks immediate **and** worker publishing. Set it consistently
  for web and worker; never attach a non-demo worker to the demo database.
  LinkedIn connect/disconnect is also disabled in demo mode.

### Unknown publication outcome

If a provider accepts a post and the request times out, or the worker dies
before persisting success, the publication outcome can be **unknown**.
Do not automatically retry or clear that state. An operator must inspect
the LinkedIn/Bluesky account, compare content and timestamps, and reconcile
the saved state with the provider post URL/ID before explicitly retrying.
A database rollback cannot undo a remote post, so retrying blindly risks duplicates.

## Demo checklist

1. Load the demo brand, then create a campaign with a sample brief.
2. Watch plan, strategy, drafts, critic feedback, and revisions in the timeline.
3. Reject/edit a draft, then approve the current revision.
4. With `PUBLIC_DEMO=1`, confirm immediate and scheduled publishing stay blocked.
5. In a private, non-demo environment, confirm an approved LinkedIn or
   X-to-Bluesky draft publishes; schedule another and verify worker logs.
6. Demonstrate Instagram/Threads copy/download export without claiming native publishing.

Keep backups and uploaded media out of git. Set cloud billing alerts and
provider spending limits; avoid unnecessary NAT gateways, ALBs, or RDS.
