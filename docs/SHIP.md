# Ship checklist — Block 9

Cut-down deploy: **one EC2 box + PM2 + Supabase**. No Docker required for
the sprint path (Compose files remain as an optional alternative).

## Pre-flight (local)

- [ ] `npm run typecheck` and `npm run test` pass
- [ ] `npm run build` succeeds (`SKIP_ENV_VALIDATION=1` is fine for CI/build)
- [ ] Supabase project is awake (free projects pause after ~1 week idle)
- [ ] `.env` has Session/Direct `DATABASE_URL` for migrations + pooler URI ok for app
- [ ] Writer + critic API keys and model ids set
- [ ] (Optional) `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` for live publish
- [ ] Billing alert on the AWS account; security group: **22 from your IP only**, **80/443 public**, **no 5432**

## First-time EC2 setup (ARM `t4g.small`)

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v   # v22.x

# Swap (2 GB RAM instance)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# PM2
sudo npm i -g pm2

# App
git clone <your-repo-url> Leno_OS && cd Leno_OS
cp .env.example .env
# edit .env — DATABASE_URL, SUPABASE_*, AI keys, models, Bluesky

npm run db:migrate
npm run db:seed          # Loopwave demo brand
./scripts/deploy.sh
pm2 startup              # follow the printed systemd command
pm2 save
```

Point a reverse proxy (Caddy / nginx) or open port 3000 briefly for demos.
Health: `curl http://127.0.0.1:3000/api/health` → `{"ok":true}`.

## Redeploy after a pull

```bash
cd Leno_OS
git pull
./scripts/deploy.sh
```

## Migrations

| When | Command |
| --- | --- |
| Schema change locally | `npm run db:generate` then commit `drizzle/` |
| Apply on Supabase | `npm run db:migrate` (Session/Direct URI) |
| Demo brand | `npm run db:seed` (idempotent upsert) |

## 2-minute demo script

1. Open `/` — brand card shows Loopwave (or load demo on `/brand`).
2. `/campaigns/new` → Load sample brief → Run campaign.
3. Narrate the live **Pipeline** timeline (plan → strategy → draft → critique → revise).
4. Open a failing draft’s critic notes; Reject with a short note (or Edit).
5. Approve a short draft → **Publish to Bluesky** (if creds set) or **Copy**.
6. Close with “what’s next”: Meta/LinkedIn OAuth, analytics, multi-tenant.

## Optional: Docker Compose

Still available if you prefer containers: `docker compose up -d --build`
(see `docker-compose.yml`). Prefer PM2 for the sprint cut.

## Cost notes

- `t4g.small` ≈ low double-digit USD/month in credits; set a billing alert.
- Avoid NAT gateways, ALBs, and RDS — Postgres is Supabase.
- Wake Supabase before the demo if the project may have paused.
