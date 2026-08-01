#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly DOMAIN="bolos.mogambo.xyz"
readonly DEPLOY_DIR="/opt/bowling-tournaments"
readonly BACKUP_DIR="/opt/backups/bowling-tournaments"
readonly API_PORT="3001"
readonly WEB_PORT="3103"
readonly MIN_FREE_DISK_KB=3145728
COMPOSE=(docker compose --env-file "$DEPLOY_DIR/.env" -f "$DEPLOY_DIR/docker-compose.prod.yml")
LOCK_FILE="/var/lock/bowling-tournaments-deploy.lock"
DEPLOY_STARTED=false
ROLLBACK_API_TAG=""
ROLLBACK_WEB_TAG=""
BASELINE_MIGRATIONS=false

case "${1:-}" in
  "") ;;
  --baseline-migrations) BASELINE_MIGRATIONS=true ;;
  *)
    printf '[bowling-deploy] ERROR: unsupported argument: %s\n' "$1"
    exit 1
    ;;
esac
[[ "$#" -le 1 ]] || {
  printf '[bowling-deploy] ERROR: too many arguments\n'
  exit 1
}

log() {
  printf '[bowling-deploy] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  return 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

check_free_disk() {
  local available_disk_kb=""
  local filesystem blocks used available capacity mounted_on

  while read -r filesystem blocks used available capacity mounted_on; do
    if [[ "$available" =~ ^[0-9]+$ ]]; then
      available_disk_kb="$available"
    fi
  done < <(df -Pk "$DEPLOY_DIR")

  [[ -n "$available_disk_kb" ]] || fail "Could not determine free disk space"
  log "Checking free disk: ${available_disk_kb} KiB available"
  if ((available_disk_kb < MIN_FREE_DISK_KB)); then
    fail "At least 3 GiB of free disk is required before building production images"
  fi
}

assert_port_available_or_owned() {
  local port="$1"
  local expected_service="$2"
  local container_id project service
  local -a owners=()

  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] && owners+=("$container_id")
  done < <(docker ps --filter "publish=$port" --format '{{.ID}}')

  for container_id in "${owners[@]}"; do
    project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$container_id")"
    service="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.service" }}' "$container_id")"
    if [[ "$project" != bowling-tournaments || "$service" != "$expected_service" ]]; then
      fail "Port $port is not owned by bowling-tournaments/$expected_service"
    fi
  done
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local attempts="${3:-30}"

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      log "$name is healthy"
      return 0
    fi
    sleep 2
  done

  fail "$name did not become healthy at $url"
}

wait_for_service_health() {
  local service="$1"
  local attempts="${2:-30}"
  local container_id status=unknown

  container_id="$("${COMPOSE[@]}" ps -q "$service")"
  if [[ -z "$container_id" ]]; then
    fail "$service container was not created"
    return 1
  fi

  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")"
    if [[ "$status" == healthy ]]; then
      log "$service Docker health is healthy"
      return 0
    fi
    if [[ "$status" == unhealthy ]]; then
      fail "$service Docker health is unhealthy"
      return 1
    fi
    if [[ "$status" == none ]]; then
      fail "$service does not define a Docker health check"
      return 1
    fi
    sleep 2
  done

  fail "$service Docker health did not become healthy (last status: $status)"
}

backup_current_images() {
  local image_id

  if read -r image_id < <("${COMPOSE[@]}" images -q api 2>/dev/null) && [[ -n "$image_id" ]]; then
    ROLLBACK_API_TAG="bowling-tournaments-api:rollback"
    docker tag "$image_id" "$ROLLBACK_API_TAG"
  fi
  if read -r image_id < <("${COMPOSE[@]}" images -q web 2>/dev/null) && [[ -n "$image_id" ]]; then
    ROLLBACK_WEB_TAG="bowling-tournaments-web:rollback"
    docker tag "$image_id" "$ROLLBACK_WEB_TAG"
  fi
}

rollback_images() {
  local status="$?"
  local -a restore_services=(postgres)
  trap - ERR

  if [[ "$DEPLOY_STARTED" == true ]]; then
    log "Deployment failed; restoring previous application images"
    if [[ -n "$ROLLBACK_API_TAG" ]]; then
      docker tag "$ROLLBACK_API_TAG" bowling-tournaments-api:latest || true
      restore_services+=(api)
    else
      "${COMPOSE[@]}" rm --stop --force api || true
    fi
    if [[ -n "$ROLLBACK_WEB_TAG" ]]; then
      docker tag "$ROLLBACK_WEB_TAG" bowling-tournaments-web:latest || true
      restore_services+=(web)
    else
      "${COMPOSE[@]}" rm --stop --force web || true
    fi
    "${COMPOSE[@]}" up -d --no-build "${restore_services[@]}" || true
  fi

  exit "$status"
}

[[ -d /var/lock && -w /var/lock ]] || fail "/var/lock is unavailable or not writable"
exec 9>"$LOCK_FILE"
flock -n 9 || fail "Another bowling deployment is already running"
trap rollback_images ERR

for command_name in docker node curl gzip nginx systemctl flock df; do
  require_command "$command_name"
done

[[ -d "$DEPLOY_DIR" ]] || fail "Deployment directory does not exist: $DEPLOY_DIR"
cd "$DEPLOY_DIR"

assert_port_available_or_owned "$API_PORT" api
assert_port_available_or_owned "$WEB_PORT" web
check_free_disk

log "Configuring non-secret production routing"
node scripts/configure-production-env.mjs \
  --file "$DEPLOY_DIR/.env" \
  --domain "$DOMAIN" \
  --api-port "$API_PORT" \
  --web-port "$WEB_PORT"
"${COMPOSE[@]}" config --quiet

mkdir -p "$BACKUP_DIR"
postgres_running=false
while IFS= read -r service; do
  if [[ "$service" == postgres ]]; then
    postgres_running=true
    break
  fi
done < <("${COMPOSE[@]}" ps --status running --services)

if [[ "$postgres_running" == true ]]; then
  backup_timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
  backup_tmp="$BACKUP_DIR/postgres-$backup_timestamp.sql.gz.tmp"
  backup_final="$BACKUP_DIR/postgres-$backup_timestamp.sql.gz"
  log "Backing up PostgreSQL to $backup_final"
  "${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip -9 >"$backup_tmp"
  gzip -t "$backup_tmp"
  mv "$backup_tmp" "$backup_final"
elif docker volume inspect bowling-tournaments_pgdata >/dev/null 2>&1; then
  fail "PostgreSQL volume exists but the service is not running; refusing to deploy without a backup"
else
  log "No PostgreSQL volume exists; treating this as a fresh installation"
fi

backup_current_images
DEPLOY_STARTED=true

log "Building production images"
"${COMPOSE[@]}" build api web

log "Starting PostgreSQL"
"${COMPOSE[@]}" up -d postgres
for ((attempt = 1; attempt <= 30; attempt += 1)); do
  if "${COMPOSE[@]}" exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER"' >/dev/null 2>&1; then
    break
  fi
  [[ "$attempt" -lt 30 ]] || fail "PostgreSQL did not become healthy"
  sleep 2
done

log "Checking migration journal"
# The outer Bash quotes preserve \$\$ so the container's /bin/sh passes
# PostgreSQL dollar-quoted strings (for example $$public$$) to psql unchanged.
migration_state="$("${COMPOSE[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT COALESCE(to_regclass(\$\$drizzle.__drizzle_migrations\$\$)::text, \$\$absent\$\$);"')"
migration_row_count=0
if [[ "$migration_state" != absent ]]; then
  migration_row_count="$("${COMPOSE[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM drizzle.__drizzle_migrations;"')"
fi
if ((migration_row_count == 0)); then
  public_table_count="$("${COMPOSE[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname = \$\$public\$\$;"')"
  if ((public_table_count > 0)); then
    if [[ "$BASELINE_MIGRATIONS" != true ]]; then
      fail "Existing schema has no Drizzle migration journal; rerun the reviewed deploy with --baseline-migrations"
    fi
    log "Validating and baselining the existing schema"
    "${COMPOSE[@]}" run --rm api \
      node /app/packages/db/scripts/baseline-production-migrations.mjs --confirm-existing-schema
  fi
fi

log "Applying audited database migrations"
"${COMPOSE[@]}" run --rm --workdir /app/packages/db api \
  node node_modules/drizzle-kit/bin.cjs migrate --config=drizzle.config.ts

log "Starting API and web"
"${COMPOSE[@]}" up -d --remove-orphans api web
wait_for_url API "http://127.0.0.1:$API_PORT/health"
wait_for_url web "http://127.0.0.1:$WEB_PORT/"
wait_for_service_health api
wait_for_service_health web

NGINX_SITE="/etc/nginx/sites-available/bolos.mogambo.xyz.conf"
NGINX_ENABLED="/etc/nginx/sites-enabled/bolos.mogambo.xyz.conf"
LEGACY_NGINX_SITE="/etc/nginx/sites-available/bowling.mogambo.xyz.conf"
LEGACY_NGINX_ENABLED="/etc/nginx/sites-enabled/bowling.mogambo.xyz.conf"
LEGACY_NGINX_WAS_ENABLED=false

if [[ ! -e "$NGINX_SITE" ]]; then
  log "Installing isolated Nginx route for $DOMAIN"
  install -m 0644 infra/nginx/bolos.mogambo.xyz.conf "$NGINX_SITE"
else
  log "Preserving existing Nginx route (including any Certbot-managed TLS)"
fi

if [[ -L "$LEGACY_NGINX_ENABLED" ]]; then
  log "Disabling the legacy Bowling Nginx route"
  LEGACY_NGINX_WAS_ENABLED=true
  rm -f "$LEGACY_NGINX_ENABLED"
fi
ln -sfn "$NGINX_SITE" "$NGINX_ENABLED"

if ! nginx -t; then
  rm -f "$NGINX_ENABLED"
  if [[ "$LEGACY_NGINX_WAS_ENABLED" == true ]]; then
    ln -sfn "$LEGACY_NGINX_SITE" "$LEGACY_NGINX_ENABLED"
  fi
  nginx -t || true
  fail "Nginx validation failed; restored the legacy Bowling route"
fi
systemctl reload nginx

DEPLOY_STARTED=false
trap - ERR
"${COMPOSE[@]}" ps
log "Deployment completed successfully"
