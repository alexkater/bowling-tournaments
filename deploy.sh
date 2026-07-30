#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# deploy.sh — Deploy Strike Manager to Hetzner VPS
# =============================================================================

VPS_HOST="178.104.71.198"
VPS_USER="root"
SSH_KEY="$HOME/.ssh/nest_deploy"
DEPLOY_DIR="/opt/bowling-tournaments"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Strike Manager Deploy ==="
echo "Host: $VPS_HOST"
echo ""

# ── 1. Verify SSH connectivity ──────────────────────────────────────
echo "[1/5] Verifying SSH connectivity..."
ssh -i "$SSH_KEY" -o ConnectTimeout=5 "$VPS_USER@$VPS_HOST" "echo OK" > /dev/null || {
  echo "ERROR: Cannot connect to $VPS_HOST"
  exit 1
}

# ── 2. Generate production .env ─────────────────────────────────────
echo "[2/5] Generating production .env..."
JWT_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)

cat > "$PROJECT_DIR/.env.production" << EOF
# Strike Manager — Production Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

POSTGRES_USER=bowling
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=bowling
JWT_SECRET=$JWT_SECRET
API_PORT=3001
WEB_PORT=3000
NEXT_PUBLIC_API_URL=http://$VPS_HOST:3001/trpc
NEXT_PUBLIC_APP_URL=http://$VPS_HOST:3000
EOF

echo "   .env.production created with fresh secrets"
echo "   NEXT_PUBLIC_API_URL=http://$VPS_HOST:3001/trpc"
echo "   NEXT_PUBLIC_APP_URL=http://$VPS_HOST:3000"

# ── 3. Sync files to server ─────────────────────────────────────────
echo "[3/5] Syncing project files to server..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.omo' \
  --exclude='.opencode' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.*.local' \
  --exclude='*.tsbuildinfo' \
  --exclude='.next' \
  --exclude='.turbo' \
  --exclude='dist' \
  --exclude='coverage' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  --exclude='apps/mobile' \
  --exclude='docs' \
  --exclude='pnpm-lock.yaml' \
  -e "ssh -i $SSH_KEY" \
  "$PROJECT_DIR/" \
  "$VPS_USER@$VPS_HOST:$DEPLOY_DIR/"

# Copy pnpm-lock.yaml separately (frozen lockfile)
scp -i "$SSH_KEY" "$PROJECT_DIR/pnpm-lock.yaml" "$VPS_USER@$VPS_HOST:$DEPLOY_DIR/"

# ── 4. Copy .env.production to server ───────────────────────────────
echo "[4/5] Copying production .env to server..."
scp -i "$SSH_KEY" "$PROJECT_DIR/.env.production" "$VPS_USER@$VPS_HOST:$DEPLOY_DIR/.env"

# ── 5. Build and start containers ───────────────────────────────────
echo "[5/5] Building and starting containers..."
ssh -i "$SSH_KEY" "$VPS_USER@$VPS_HOST" << 'ENDSSH'
set -euo pipefail
cd /opt/bowling-tournaments

echo "   Pulling base images..."
docker pull node:20-alpine &
docker pull postgres:16-alpine &
wait

echo "   Building containers..."
docker compose -f docker-compose.prod.yml build --no-cache 2>&1 | tail -3

echo "   Starting services..."
docker compose -f docker-compose.prod.yml up -d postgres

echo "   Waiting for PostgreSQL to be healthy..."
sleep 5
for i in $(seq 1 20); do
  if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U bowling > /dev/null 2>&1; then
    echo "   PostgreSQL is ready!"
    break
  fi
  sleep 2
done

echo "   Running database schema push..."
docker compose -f docker-compose.prod.yml run --rm api npx drizzle-kit push --config=packages/db/drizzle.config.ts 2>&1 | tail -3

echo "   Starting all services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "   Waiting for API to be healthy..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "   API is healthy!"
    break
  fi
  sleep 2
done

echo ""
echo "   Container status:"
docker compose -f docker-compose.prod.yml ps
ENDSSH

echo ""
echo "=== Deploy complete ==="
echo "API:  http://$VPS_HOST:3001/health"
echo "Web:  http://$VPS_HOST:3000"
echo ""
echo "Logs: ssh -i $SSH_KEY $VPS_USER@$VPS_HOST 'docker compose -f $DEPLOY_DIR/docker-compose.prod.yml logs -f'"
