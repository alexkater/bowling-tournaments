# Prompt: Complete Tournament CRUD

## Goal
Implement full CRUD for tournaments (create, read, update, delete, list) across all layers.

## Layer 1: DB Schema
- Crear `packages/db/src/schema/tournament.ts` con `pgTable('tournaments', ...)`
- Columnas: id, orgId, name, description, status, category, scoringType, config (jsonb), startDate, endDate, registrationDeadline, createdAt, updatedAt
- Relación con organizations

## Layer 2: Shared Types
Ya existen en `packages/shared/src/types/tournament.ts` — verificar que cubren todos los campos.

## Layer 3: API
- Completar el router `apps/api/src/routers/tournament.ts`
- Implementar: list, byId, create, update, delete
- Usar `CreateTournamentSchema` y `UpdateTournamentSchema` de shared
- Paginación con cursor para list
- Filtros por status, date range

## Layer 4: Web
- Página `/dashboard/tournaments` — lista con filtros + botón crear
- Página `/dashboard/tournaments/new` — formulario paso a paso (info general → configuración → fechas)
- Página `/dashboard/tournaments/[id]` — detalle con solapas (overview, squads, standings, brackets)
- Página `/dashboard/tournaments/[id]/edit` — formulario pre-rellenado

## Layer 5: Mobile
- Pantalla de lista de torneos disponibles (solo lectura)
- Pantalla de detalle del torneo

## Files
- `packages/db/src/schema/tournament.ts`
- `packages/db/src/schema/index.ts`
- `apps/api/src/routers/tournament.ts`
- `apps/web/src/app/dashboard/tournaments/page.tsx`
- `apps/web/src/app/dashboard/tournaments/new/page.tsx`
- `apps/web/src/app/dashboard/tournaments/[id]/page.tsx`

## Validation
- Fechas: startDate debe ser futura, endDate > startDate
- Status transitions: draft → published → in_progress → completed
- Config: handicapBase entre 150-300
