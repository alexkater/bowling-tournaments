#!/usr/bin/env bash
set -Eeuo pipefail

readonly VPS_HOST="178.104.71.198"
readonly VPS_USER="root"
readonly SSH_KEY="$HOME/.ssh/nest_deploy"
readonly DEPLOY_DIR="/opt/bowling-tournaments"
readonly DOMAIN="bowling.mogambo.xyz"
readonly API_PORT="3001"
readonly WEB_PORT="3103"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSH_OPTIONS=(-i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10)
BASELINE_ARGUMENT=""

case "${1:-}" in
  "") ;;
  --baseline-migrations) BASELINE_ARGUMENT="--baseline-migrations" ;;
  *)
    printf '[bowling-sync] ERROR: unsupported argument: %s\n' "$1"
    exit 1
    ;;
esac
[[ "$#" -le 1 ]] || {
  printf '[bowling-sync] ERROR: too many arguments\n'
  exit 1
}

log() {
  printf '[bowling-sync] %s\n' "$*"
}

[[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$ ]] || {
  log "ERROR: invalid DOMAIN"
  exit 1
}
[[ "$API_PORT" =~ ^[0-9]+$ && "$WEB_PORT" =~ ^[0-9]+$ ]] || {
  log "ERROR: ports must be numeric"
  exit 1
}
[[ -f "$SSH_KEY" ]] || {
  log "ERROR: SSH key not found: $SSH_KEY"
  exit 1
}

CURRENT_BRANCH="$(git -C "$PROJECT_DIR" branch --show-current)"
[[ "$CURRENT_BRANCH" == main ]] || {
  log "ERROR: production deploys require the local main branch (current: $CURRENT_BRANCH)"
  exit 1
}
[[ -z "$(git -C "$PROJECT_DIR" status --porcelain)" ]] || {
  log "ERROR: production deploys require a clean working tree"
  exit 1
}

log "Verifying local main matches origin/main"
ORIGIN_URL="$(git -C "$PROJECT_DIR" remote get-url origin)"
case "$ORIGIN_URL" in
  https://github.com/alexkater/bowling-tournaments.git | \
    git@github.com:alexkater/bowling-tournaments.git | \
    git@github-mogamboai:alexkater/bowling-tournaments.git) ;;
  *)
    log "ERROR: origin is not the canonical bowling-tournaments repository"
    exit 1
    ;;
esac
git -C "$PROJECT_DIR" fetch --quiet origin main
LOCAL_SHA="$(git -C "$PROJECT_DIR" rev-parse HEAD)"
REMOTE_SHA="$(git -C "$PROJECT_DIR" rev-parse origin/main)"
[[ "$LOCAL_SHA" == "$REMOTE_SHA" ]] || {
  log "ERROR: local HEAD does not match origin/main"
  exit 1
}

log "Verifying isolated deployment target"
ssh "${SSH_OPTIONS[@]}" "$VPS_USER@$VPS_HOST" \
  "test -d '$DEPLOY_DIR' && test -w '$DEPLOY_DIR'"

log "Synchronizing reviewed source; production secrets remain server-side"
rsync -az --delete \
  --exclude='.git/' \
  --exclude='.env*' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='.turbo/' \
  --exclude='dist/' \
  --exclude='coverage/' \
  --exclude='playwright-report/' \
  --exclude='test-results/' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  -e "ssh -i '$SSH_KEY' -o BatchMode=yes -o ConnectTimeout=10" \
  "$PROJECT_DIR/" \
  "$VPS_USER@$VPS_HOST:$DEPLOY_DIR/"

log "Running locked production deployment"
if [[ -n "$BASELINE_ARGUMENT" ]]; then
  ssh "${SSH_OPTIONS[@]}" "$VPS_USER@$VPS_HOST" \
    "bash '$DEPLOY_DIR/scripts/deploy-server.sh' --baseline-migrations"
else
  ssh "${SSH_OPTIONS[@]}" "$VPS_USER@$VPS_HOST" \
    "bash '$DEPLOY_DIR/scripts/deploy-server.sh'"
fi

log "Deployment finished; route configured for $DOMAIN"
