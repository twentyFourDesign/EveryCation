#!/usr/bin/env bash
# Pulls the latest code, rebuilds and restarts. Database changes are applied as the API starts.
set -euo pipefail
cd /opt/everycation
git fetch -q origin "${BRANCH:-main}" && git reset -q --hard "origin/${BRANCH:-main}"
cd deploy
/opt/everycation/deploy/backup.sh
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
