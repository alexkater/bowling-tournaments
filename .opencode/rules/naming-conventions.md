# Naming Conventions

## TypeScript
- **Archivos**: kebab-case (`tournament-service.ts`, `score-entry.tsx`)
- **Componentes React**: PascalCase (`TournamentCard.tsx`, `StandingsTable.tsx`)
- **Funciones y variables**: camelCase (`calculateHandicap`, `getStandings`)
- **Tipos e interfaces**: PascalCase (`TournamentConfig`, `StandingsEntry`)
- **Schemas Zod**: PascalCase + suffix Schema (`CreateTournamentSchema`)
- **Enums**: PascalCase (`TournamentStatus`)
- **Constantes**: UPPER_SNAKE_CASE solo para valores mágicos mapeables (`MAX_GAMES_PER_EVENT`)

## Database
- **Tablas**: snake_case, plural (`tournaments`, `tournament_players`)
- **Columnas**: snake_case (`first_name`, `handicap_base`, `is_active`)
- **Foreign keys**: `<referenced_table>_id` (`organization_id`, `tournament_id`)
- **Timestamps**: `created_at`, `updated_at`
- **JSON columns**: explicitadas con $type en Drizzle

## tRPC
- **Routers**: camelCase, singular (`tournament`, `squad`, `standings`)
- **Procedures**: camelCase, verbo inicial (`list`, `byId`, `create`, `registerPlayer`)
- **Input schemas**: ZipZod inline para queries simples, referencia a shared para mutations

## URL Routes (Web)
- **Dashboard**: `/dashboard/tournaments`, `/dashboard/tournaments/[id]/standings`
- **Público**: `/tournaments/[id]`, `/standings/[squadId]`
- **API (tRPC)**: `/trpc/tournament.list`, `/trpc/tournament.create`

## Git
- **Commits**: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`)
- **Branches**: `feat/<feature-name>`, `fix/<bug-description>`, `chore/<task>`
