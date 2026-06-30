#!/usr/bin/env bash
# Pull-based continuous deployment for the JJAN/Ki Clash NCP backend.
#
# WHY PULL, NOT PUSH: the NCP host IP rotates and the box is a shared
# production server, so we don't want to open SSH (22) to GitHub's changing
# runner IP ranges. Instead the server reaches OUT to GitHub on a timer,
# fast-forwards main, and rebuilds only when something actually changed.
# Zero inbound connections -> immune to IP churn on both ends.
#
# INSTALL (one time, on the NCP server, in the cloned repo dir):
#   chmod +x deploy/naver-cloud/auto-deploy.sh
#   ( crontab -l 2>/dev/null; echo "*/3 * * * * cd $(pwd) && ./deploy/naver-cloud/auto-deploy.sh >> /var/log/jjan-deploy.log 2>&1" ) | crontab -
#
# Then every push to main auto-deploys within ~3 minutes. No manual SSH ever.
# Tail logs with:  tail -f /var/log/jjan-deploy.log
set -euo pipefail

BRANCH="main"
COMPOSE_FILE="docker-compose.naver.yml"
LOCK="/tmp/jjan-auto-deploy.lock"

# Resolve the repo root from this script's location (works under cron).
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_DIR"

# Single-flight: skip if a previous run (e.g. a slow build) is still going.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -Is) another auto-deploy is running; skipping"
  exit 0
fi

git fetch --quiet origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0  # nothing new; stay quiet so the log only shows real deploys
fi

echo "$(date -Is) deploying $LOCAL -> $REMOTE"
git pull --ff-only origin "$BRANCH"
COMPOSE_PROJECT_NAME=jjan docker compose -f "$COMPOSE_FILE" up -d --build
COMPOSE_PROJECT_NAME=jjan docker compose -f "$COMPOSE_FILE" ps
echo "$(date -Is) deploy complete at $(git rev-parse --short HEAD)"
