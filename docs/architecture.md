# Architecture

## Stack

| Layer | Technology |
|---|---|
| **Web** (organizers) | Next.js 15 + React 19 + Tailwind 4 |
| **Mobile** (players) | Expo SDK 52 + React Native 0.76 |
| **API** | Fastify 5 + tRPC 11 |
| **Database** | PostgreSQL (via Supabase) |
| **ORM** | Drizzle ORM |
| **Validation** | Zod (shared between web, mobile, api) |
| **State** | TanStack Query (server state) |
| **Realtime** | WebSocket via Fastify |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Auth** | Supabase Auth |
| **Hosting** | Vercel (web), Railway/Fly (api), EAS (mobile) |

## Architecture Principles

1. **Shared domain model** — `@bowling/shared` contiene tipos, schemas Zod y lógica de negocio. Todo el resto depende de esto.
2. **tRPC como contrato** — el router tRPC es la única fuente de verdad para la API. Clientes web y mobile consumen el mismo tipo.
3. **Online-first, offline-resilient** — las apps dependen de conexión en tiempo real pero cachean localmente para tolerar cortes.
4. **Event-driven scoring** — las puntuaciones se actualizan vía WebSocket. Todos los clientes reciben pushes.

## Estructura del Monorepo

```
bowling-tournaments/
├── apps/
│   ├── web/          # Next.js - organizadores
│   ├── mobile/       # Expo - jugadores
│   └── api/          # Fastify + tRPC
├── packages/
│   ├── shared/       # Tipos, schemas, utils (handicap, tiebreaker)
│   ├── db/           # Drizzle schema + migrations
│   └── ui/           # Componentes UI compartidos
└── docs/
```

## Data Flow

```
Web (Next.js) ──┐
Mobile (Expo) ──┼── tRPC ── Fastify ── PostgreSQL
                │              │
                └── WebSocket ─┘  (real-time standings)
```

## Domain Model (Principales Entidades)

```
Organization 1──N Tournament 1──N Squad
                │              N──N Player (via TournamentPlayer)
                │              └── Sidepot
                │              └── BracketPool
                │                     └── BracketRound
                │                            └── BracketMatch
                │              Player 1──N Game
                │                           └── Frame
```
