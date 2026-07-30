# Strike Manager — Bowling Tournament Management

A full-stack bowling tournament management platform. Organisers can create tournaments with multiple formats, manage brackets and sidepots, track live standings, and handle player registration through a web dashboard. Players can follow results in real-time via a mobile app.

**Stack:** pnpm + Turborepo | Fastify + tRPC + Drizzle ORM + PostgreSQL | Next.js 15 + React 19 + Tailwind 4 | Expo (React Native)

---

## Prerequisites

| Tool       | Version      | Notes                                          |
|------------|-------------|------------------------------------------------|
| Node.js    | >= 20        | Required for ESM and modern JS features        |
| pnpm       | 9.1.0        | Use `corepack enable && corepack prepare pnpm@9.1.0 --activate` |
| Docker     | >= 24        | For local PostgreSQL and production deployment |
| PostgreSQL | 16           | Only if running outside Docker                 |

---

## Quick Start (Local Development)

### 1. Clone and configure environment

```bash
git clone <repo-url> bowling-tournaments
cd bowling-tournaments
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable        | Description                                        | Default                                    |
|----------------|----------------------------------------------------|-------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string (use `localhost` for local dev) | `postgres://bowling:bowling@localhost:5432/bowling` |
| `JWT_SECRET`   | Secret key for signing auth tokens                 | Generate one: `openssl rand -hex 32`      |
| `PORT`         | API server port (server reads `process.env.PORT`)  | `3001`                                     |
| `NEXT_PUBLIC_API_URL` | tRPC endpoint for the browser               | `http://localhost:3001/trpc`               |
| `NEXT_PUBLIC_APP_URL` | Public web app URL                            | `http://localhost:3000`                    |

> **Note:** The API server reads `process.env.PORT` (not `API_PORT`). The `.env.example` includes `API_PORT` for reference, but `PORT` is what the server uses.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Start PostgreSQL and run migrations

```bash
# Start the database (from the existing docker-compose.yml)
docker compose up -d postgres

# Push the Drizzle schema to the database
pnpm --filter @bowling/db push
```

### 4. Start development servers

```bash
pnpm dev
```

This starts all apps concurrently via Turborepo:
- **API** → http://localhost:3001 (health check: http://localhost:3001/health)
- **Web** → http://localhost:3000
- **Mobile** → Expo dev server (scan QR code with Expo Go)

---

## Running Tests

```bash
# All tests
pnpm test

# Individual packages
pnpm --filter @bowling/shared test
pnpm --filter @bowling/api test

# E2E tests (requires dev servers running)
pnpm --filter @bowling/web exec playwright test
```

---

## Production Deployment (Hetzner VPS)

These instructions cover a bare-metal Docker deployment on a Hetzner VPS (or any Linux server).

### 1. Server setup

```bash
# SSH into your Hetzner VPS
ssh root@<your-vps-ip>

# Install Docker and Docker Compose plugin
apt update && apt install -y docker.io docker-compose-plugin

# Verify
docker --version
docker compose version
```

### 2. Clone the repository

```bash
git clone <repo-url> /opt/bowling-tournaments
cd /opt/bowling-tournaments
```

### 3. Configure production environment

```bash
cp .env.example .env
```

Edit `.env` with production values:

```ini
# Database — Docker service name "postgres" resolves within the compose network
DATABASE_URL="postgres://bowling:bowling@postgres:5432/bowling"

# Security — generate a strong secret
JWT_SECRET="<generate with: openssl rand -hex 32>"

# Supabase (optional — for auth)
SUPABASE_URL="https://<your-project>.supabase.co"
SUPABASE_ANON_KEY="<your-anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

# Stripe (optional — for payments)
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."

# API — internal port; the server reads process.env.PORT
PORT=3001

# Web — replace with your actual domain or VPS IP
NEXT_PUBLIC_API_URL="http://<your-vps-ip>:3001/trpc"
NEXT_PUBLIC_APP_URL="http://<your-vps-ip>:3000"

# Resend (optional — for email)
RESEND_API_KEY="re_..."
```

### 4. Run database migrations

```bash
# Start only the database
docker compose -f docker-compose.prod.yml up -d postgres

# Run the Drizzle schema push (via a one-shot container)
docker compose -f docker-compose.prod.yml run --rm api pnpm --filter @bowling/db push
```

### 5. Start all services

```bash
docker compose -f docker-compose.prod.yml up -d
```

This builds and starts:
- **postgres** — PostgreSQL 16 with persistent volume
- **api** — Fastify + tRPC server (port 3001)
- **web** — Next.js 15 app (port 3000)

### 6. Verify deployment

```bash
# Check service status
docker compose -f docker-compose.prod.yml ps

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Health check
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"2025-..."}

# Web app
curl http://localhost:3000
```

### 7. (Optional) Add a reverse proxy

For SSL and a single entry point, install Caddy or nginx on the host:

**Caddy example** (`/etc/caddy/Caddyfile`):
```
yourdomain.com {
    reverse_proxy localhost:3000
}

api.yourdomain.com {
    reverse_proxy localhost:3001
}
```

Update the `.env` `NEXT_PUBLIC_*` URLs accordingly and rebuild:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## API Endpoints

| Endpoint              | Method | Description                          |
|-----------------------|--------|--------------------------------------|
| `/health`             | GET    | Health check (returns status + time) |
| `/trpc/*`             | POST   | All tRPC procedures                  |

The API uses **tRPC** — all RPC endpoints are type-safe and called via the tRPC client on port 3001 under the `/trpc` prefix. See `apps/api/src/routers/` for the full procedure list.

---

## Architecture Notes

```
bowling-tournaments/
├── apps/
│   ├── api/             # Fastify + tRPC server
│   │   ├── src/
│   │   │   ├── server.ts       # Entry point, Fastify bootstrap
│   │   │   ├── routers/        # tRPC routers (API procedures)
│   │   │   └── context.ts      # Request context (auth, db)
│   │   └── dist/               # Compiled JS (production)
│   │
│   ├── web/             # Next.js 15 + Tailwind 4
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   └── lib/            # tRPC client, utilities
│   │   └── .next/              # Next.js build output
│   │
│   └── mobile/          # Expo (React Native) — player app
│
├── packages/
│   ├── shared/          # Zod schemas, domain logic, types
│   ├── db/              # Drizzle ORM schema + migrations
│   └── ui/              # Shared React components
│
├── Dockerfile.api       # Multi-stage Docker build for the API
├── Dockerfile.web       # Multi-stage Docker build for the web app
└── docker-compose.prod.yml  # Production Docker Compose
```

### Key design decisions

- **Domain logic lives in `@bowling/shared`.** The API, web, and mobile are delivery channels only. Handicap calculations, bracket algorithms, payout formulas — all pure functions in shared, 100% testable.
- **tRPC as the single API contract.** Type-safe RPC between the web app and the API server. No REST endpoints (except `/health`). No code generation.
- **Drizzle ORM** with PostgreSQL. The `@bowling/db` package owns the schema and migrations. `pnpm --filter @bowling/db push` syncs the schema.
- **Supabase Auth** for authentication. JWT tokens are verified in the tRPC request context.
- **WebSocket** (Fastify) for real-time updates during tournaments.

### Docker image structure

| Image         | Base         | Size (approx.) | Notes                            |
|---------------|-------------|----------------|----------------------------------|
| `bowling-api` | node:20-alpine | ~200 MB     | Multi-stage, prod deps only      |
| `bowling-web` | node:20-alpine | ~250 MB     | Standalone output, static copied |
| `postgres`    | postgres:16-alpine | ~200 MB | Official image, persistent volume |

### Environment variables reference

| Variable | Required | Service | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | api | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | api | Secret for signing auth tokens |
| `PORT` | ❌ | api | API listen port (default: 3001) |
| `SUPABASE_URL` | ❌ | api | Supabase project URL |
| `SUPABASE_ANON_KEY` | ❌ | api | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | api | Supabase service role key |
| `STRIPE_SECRET_KEY` | ❌ | api | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | ❌ | api | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ❌ | api, web | Stripe publishable key |
| `RESEND_API_KEY` | ❌ | api | Resend API key for emails |
| `NEXT_PUBLIC_API_URL` | ✅ | web | tRPC endpoint URL for the browser |
| `NEXT_PUBLIC_APP_URL` | ✅ | web | Public web app URL |

---

## Dockerfiles reference

### Dockerfile.api (3 stages)

1. **base** — Node 20 Alpine, pnpm activated
2. **builder** — Installs all deps, compiles `@bowling/shared` + `@bowling/db` with `tsc`, patches their `package.json` exports for production resolution, then compiles the API
3. **runner** — Fresh `pnpm install --prod` for minimal image, copies compiled artifacts

### Dockerfile.web (4 stages)

1. **base** — Node 20 Alpine, pnpm activated
2. **deps** — Installs all deps (cached layer, reuses lockfile)
3. **builder** — Builds Next.js with `output: 'standalone'`
4. **runner** — Copies standalone server, static files, public assets; runs as non-root `nextjs` user

---

## Useful commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Rebuild a single service
docker compose -f docker-compose.prod.yml up -d --build api

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop and remove volumes (⚠️ destroys database data)
docker compose -f docker-compose.prod.yml down -v

# Run a one-off command inside a container
docker compose -f docker-compose.prod.yml exec api node apps/api/dist/server.js --help

# Database backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U bowling bowling > backup.sql

# Database restore
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U bowling bowling
```
