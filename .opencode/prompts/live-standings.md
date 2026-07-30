# Prompt: Live Standings

## Goal
Real-time standings that auto-update as scores are entered, viewable on web and mobile.

## API
- `standings.getBySquad(squadId)` — standings actuales
- `standings.getByTournament(tournamentId)` — multi-squad combined si aplica
- `standings.getPublic(squadId)` — sin auth, para link público

## Web (Organizador)
- Tabla de clasificación en tiempo real con WebSocket
- Columnas: rank, player name, game scores, total raw, total handicap, behind leader
- Highlight al jugador que está en racha (último juego mejoró posición)
- Botón para copiar link público

## Web (Público)
- Página pública sin auth: `/standings/[squadId]`
- QR code para compartir
- Auto-refresh si no hay WebSocket (fallback cada 30s)
- Versión simplificada: solo top 10 + búsqueda por nombre

## Mobile
- Pantalla principal: standings del torneo activo
- Pull-to-refresh + WebSocket
- Tap en jugador para ver detalle de juegos
- QR scanner para abrir standings

## Reglas
- Standings se recalculan con cada score entry (vía scoring-engine skill)
- Cache en API con invalidation por WebSocket
- Tiebreakers aplicados según config del torneo
- Máximo 50 players visibles sin paginación (después, paginación)

## Files
- `apps/api/src/routers/standings.ts`
- `apps/api/src/services/standings.service.ts`
- `apps/web/src/app/dashboard/tournaments/[id]/standings/page.tsx`
- `apps/web/src/app/standings/[squadId]/page.tsx`
- `apps/mobile/src/app/standings.tsx`
