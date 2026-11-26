#!/usr/bin/env bash
# Saves a copy of the database to /var/backups/everycation and keeps the last 14 days.
# Restore one with: docker compose exec -T postgres pg_restore -U everycation -d everycation --clean < FILE
set -euo pipefail
OUT=/var/backups/everycation
mkdir -p "$OUT"; chmod 700 "$OUT"
cd /opt/everycation/deploy
FILE="$OUT/everycation-$(date +%Y%m%d-%H%M).dump"
docker compose exec -T postgres pg_dump -U everycation -d everycation -Fc > "$FILE"
find "$OUT" -name 'everycation-*.dump' -mtime +14 -delete
echo "$(date -Is) saved $FILE ($(du -h "$FILE" | cut -f1))"
