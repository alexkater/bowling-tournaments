# Strike Manager — Bowling Tournament Management

## Stack

- **Monorepo**: pnpm + Turborepo
- **Shared**: `@bowling/shared` — tipos, Zod schemas, lógica de negocio
- **API**: Fastify + tRPC + Drizzle ORM + PostgreSQL
- **Web**: Next.js 15 + React 19 + Tailwind 4
- **Mobile**: Expo SDK 52 + React Native
- **Auth**: Supabase Auth
- **Realtime**: WebSocket (Fastify)
- **Testing**: Vitest (unit/integration) + Playwright (E2E)

## Project Structure

```
bowling-tournaments/
├── apps/
│   ├── web/          # Organizer web app
│   ├── mobile/       # Player mobile app
│   └── api/          # Fastify + tRPC server
├── packages/
│   ├── shared/       # Types, schemas, utils
│   ├── db/           # Drizzle schema + migrations
│   └── ui/           # Shared components
├── docs/             # Architecture, requirements, roadmap
└── .opencode/        # Agents, skills, rules
```

## Commands

- `pnpm dev` — Start all dev servers
- `pnpm build` — Build all packages
- `pnpm test` — Run all tests
- `pnpm lint` — Lint all packages
- `pnpm typecheck` — TypeScript check all
- `pnpm format` — Prettier format

## Development Rules

- Toda la lógica de negocio va en `@bowling/shared`. La API, web y mobile son solo canales de entrega.
- **El domain core es el foso competitivo**. Handicap, brackets, payouts, tiebreakers, state machines — funciones puras, sin dependencias externas, 100% testable.
- Los módulos de utils son independientes entre sí (handicap.ts no importa brackets.ts).
- Schemas Zod en shared, tipos inferidos con `z.infer`.
- tRPC es el único contrato API.
- **Tests unitarios obligatorios para TODO el domain core antes de escribir cualquier UI.** Coverage del 100% de casos borde documentados en `docs/testing.md`.
- Cada bug en producción → primero el test que lo reproduce, luego el fix. Sin excepción.
- Property-based tests (fast-check) para handicap, brackets, payouts.
- Commits atómicos con conventional commits.

## Domain Naming

- Tournament: torneo con configuración, fechas, formato
- Squad: sesión de juego dentro de un torneo
- BracketPool: pool de brackets (sidepot)
- Sidepot: apuesta lateral (high game, eliminator, etc.)
- TournamentPlayer: inscripción de un jugador a un torneo

## UI Design Rules

- **Ultra-profesional, premium SaaS.** Nada de UI genérica "AI-generated".
- Sin emojis en la UI. Iconos solo via lucide-react.
- Paleta de colores custom, bowling-inspired (caoba, azul pizarra, blanco), nunca paletas default de Tailwind.
- Dark backgrounds con acentos de alto contraste (las boleras son oscuras).
- Tailwind v4 + Next.js requiere `@tailwindcss/postcss` como devDep + `postcss.config.mjs`.
- Los colores custom se definen con `@theme { --color-*: ... }` en globals.css.

## Production Deploy

- Hetzner VPS: IP 178.104.71.198, SSH key ~/.ssh/nest_deploy
- Production URL: `https://bowling.mogambo.xyz`
- Bowling-only bindings: API `127.0.0.1:3001`, web `127.0.0.1:3103`
- Deploy only merged `main` with `./deploy.sh`; it syncs source and invokes the locked server deploy
- The existing database needs `./deploy.sh --baseline-migrations` exactly once; routine deploys use committed Drizzle migrations and never `push`
- `/opt/bowling-tournaments/.env` is persistent and server-only; normal deploys never rotate or copy secrets
- The server deploy validates Compose, backs up PostgreSQL, applies migrations, runs health checks, configures the isolated Nginx site, and retains image rollback tags
- Never modify another project's containers, ports, Nginx sites, directories, databases, or environment files
- La API en producción usa `node --import tsx` con la dependencia bloqueada, sin `npx` ni descargas runtime
