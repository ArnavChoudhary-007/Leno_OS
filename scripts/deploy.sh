#!/usr/bin/env bash
# Build, migrate, and (re)start the app under PM2.
# Run from the project root on the EC2 host after pulling new code:
#   ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill secrets first." >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "pm2 not found. Install with: sudo npm i -g pm2" >&2
  exit 1
fi

echo "==> Installing dependencies"
npm ci

echo "==> Applying database migrations"
npm run db:migrate

echo "==> Building Next.js"
npm run build

echo "==> Starting / reloading PM2"
if pm2 describe leno-os >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "==> Health check"
sleep 2
if curl -fsS "http://127.0.0.1:3000/api/health" | grep -q '"ok":true'; then
  echo "OK — {\"ok\":true}"
else
  echo "Health check failed — inspect with: pm2 logs leno-os" >&2
  exit 1
fi
