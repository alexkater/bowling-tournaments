# Agent: API Core

## Purpose
Build and maintain the Fastify + tRPC API server. This is the backbone of the entire platform.

## Domain
- tRPC router definitions (all endpoints)
- Business logic services
- Database access via Drizzle ORM
- WebSocket server for real-time standings
- Authentication & authorization middleware
- Stripe webhook handling
- PDF report generation
- File upload (avatars, tournament images)
- Background jobs (email notifications, cleanup)

## Stack
- Fastify 5 (HTTP server)
- tRPC 11 (type-safe API)
- Drizzle ORM + PostgreSQL (database)
- SuperJSON (serialization)
- @fastify/websocket (real-time)
- Stripe SDK (payments)
- Bull/BullMQ (background jobs, optional)
- nodemailer / Resend (emails)
- Sharp (image processing)

## Architecture

### Project Structure
```
src/
├── server.ts                 # Entry point
├── trpc.ts                   # tRPC init
├── context.ts                # Request context
├── routers/                  # tRPC routers
│   ├── index.ts              # App router (merge)
│   ├── tournament.ts
│   ├── squad.ts
│   ├── standings.ts
│   ├── bracket.ts
│   ├── sidepot.ts
│   ├── player.ts
│   ├── auth.ts
│   └── reports.ts
├── services/                 # Business logic
│   ├── score.service.ts
│   ├── standings.service.ts
│   ├── bracket.service.ts
│   ├── payout.service.ts
│   ├── report.service.ts
│   └── stripe.service.ts
├── middleware/
│   ├── auth.ts               # requireAuth, requireOrgAccess
│   └── rate-limit.ts
└── utils/
    ├── errors.ts             # Error codes & messages
    └── websocket.ts          # WS manager
```

### tRPC Patterns
```ts
// Query (lectura)
list: procedure.input(z.object({...})).query(async ({ ctx, input }) => {...})

// Mutation (escritura)
create: procedure.input(Schema).mutation(async ({ ctx, input }) => {...})

// Subscription (WebSocket real-time)
onStandingsUpdate: procedure.input(z.string()).subscription(async function* ({ ctx, input }) {...})
```

### Error Handling
```ts
import { TRPCError } from '@trpc/server'

// Códigos estándar:
// PARSE_ERROR, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, INTERNAL_SERVER_ERROR

throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Tournament not found',
})
```

### WebSocket Manager
```ts
// apps/api/src/utils/websocket.ts
// Mantener mapa de conexiones: Map<tournamentId, Set<WebSocket>>
// Broadcast a todos los clientes de un torneo cuando cambian standings
// Heartbeat cada 30s para detectar conexiones muertas
// Reconexión: el cliente envía lastEventId, servidor reenvía eventos perdidos
```

## Rate Limiting
- 100 req/min por IP (endpoints públicos)
- 300 req/min por usuario autenticado
- WebSocket: 60 mensajes/min por conexión

## Database
- Pool de conexiones con pgBouncer (recomendado para serverless)
- Query logging en desarrollo
- Migraciones automáticas en deploy
- Read replicas para standings (futuro)

## Security
- Helmet headers
- CORS configurado para dominios permitidos
- Input validation con Zod en cada procedure
- SQL injection prevenido por Drizzle (parameterized queries)
- Stripe webhook signature verification

## Testing
- Integration tests con test database (PostgreSQL testcontainer o neon db)
- Vitest + supertest para routers
- Mock Stripe para tests de pagos
