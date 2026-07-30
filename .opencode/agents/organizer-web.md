# Agent: Organizer Web

## Purpose
Build and maintain the Next.js web application for tournament organizers. This is the primary interface where organizers create, manage, and run tournaments.

## Domain
- Tournament CRUD (create, edit, publish, cancel)
- Squad & lane management (create squads, assign lanes)
- Score entry (grid interface for entering game scores)
- Bracket & sidepot management (create pools, shuffle, advance rounds, payouts)
- Standings (live standings table with real-time updates)
- Reports (PDF generation for lane assignments, standings, financials)
- Dashboard (overview of active tournaments, quick actions)
- Player management (roster, check-in, waitlist)

## Stack
- Next.js 15 (App Router)
- React 19
- Tailwind 4
- @bowling/shared (types, schemas)
- @trpc/react-query (API client)
- @tanstack/react-query (server state)
- lucide-react (icons)
- next-intl (i18n, future)

## Architecture Decisions

### Server vs Client Components
- **Server por defecto**: Layouts, páginas estáticas, metadata
- **Client cuando**: Interactividad (forms, tabs, modals, real-time data)
- Usar `'use client'` en el mínimo componente necesario, no en la página entera

### Data Fetching
- Server Components: fetch inicial con tRPC server client
- Client Components: @tanstack/react-query para data con caché
- Real-time: WebSocket para standings (conectar en mount, cleanup en unmount)

### Routing
```
/dashboard                    → Overview de torneos activos
/dashboard/tournaments       → Lista de torneos
/dashboard/tournaments/new   → Crear torneo
/dashboard/tournaments/[id]  → Detalle del torneo
  /standings                 → Clasificaciones
  /squads                    → Gestión de squads
    /[squadId]/scores        → Ingreso de puntuaciones
  /brackets                  → Bracket pools
  /sidepots                  → Sidepots
  /players                   → Roster
  /reports                   → Reportes PDF
  /settings                  → Configuración
/public/tournaments          → Torneos públicos
/public/tournaments/[id]     → Página pública del torneo
/standings/[squadId]         → Standings públicos
/login                       → Inicio de sesión
/signup                      → Registro
```

## Domain Rules
- Un torneo tiene múltiples squads (sesiones de juego)
- Un squad tiene múltiples jugadores asignados a carriles
- Las puntuaciones se ingresan por jugador por juego
- Los brackets son sidepots opcionales dentro de un torneo
- Los sidepots (high game, eliminator) son independientes de los brackets
- El organizador puede cerrar inscripciones, iniciar juego, cancelar torneo
- Los standings se actualizan en vivo vía WebSocket

## State Management
- Server state: TanStack Query (caché, refetch, optimistic updates)
- URL state: search params para filtros, tabs
- Form state: React Hook Form + Zod
- No Redux, no Zustand global — el server es la single source of truth

## Performance
- Páginas de scores: virtualizar grid si > 50 jugadores
- Páginas de brackets: lazy load bracket trees
- Imágenes: next/image
- Bundle: análisis con @next/bundle-analyzer en build

## Testing
- Vitest para lógica de componentes y hooks
- Playwright para E2E: crear torneo → registrar players → ingresar scores → ver standings
