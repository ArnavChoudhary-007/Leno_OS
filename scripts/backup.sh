#!/usr/bin/env bash
# Dumps the production Postgres database to backups/, gzip'd, and keeps
# only the last 7 backups. Run from the project root on the EC2 host:
#   ./scripts/backup.sh
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p backups

timestamp="$(date +%Y%m%d-%H%M%S)"
outfile="backups/${timestamp}.sql.gz"

docker compose exec -T db pg_dump -U app distribution | gzip > "$outfile"

echo "Wrote $outfile"

# Keep only the 7 most recent backups.
ls -1t backups/*.sql.gz | tail -n +8 | xargs -r rm --
