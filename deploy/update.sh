#!/usr/bin/env bash
# Pulls the latest code, rebuilds and restarts. Database changes are applied as the API starts.
set -euo pipefail
cd /opt/everycation
git fetch -q origin "${BRANCH:-main}" && git reset -q --hard "origin/${BRANCH:-main}"
cd deploy
# Servers set up before the app's web version existed get its address next to the API's.
if ! grep -q '^APP_HOST=' .env; then
  api=$(grep '^API_HOST=' .env | cut -d= -f2-)
  echo "APP_HOST=app.${api#api.}" >> .env
  echo "Added APP_HOST=app.${api#api.} to .env"
fi
/opt/everycation/deploy/backup.sh
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
