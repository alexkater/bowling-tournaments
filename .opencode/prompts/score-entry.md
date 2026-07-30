# Prompt: Score Entry

## Goal
Allow organizers to enter scores for each player per game, with real-time standings recalculation.

## Flujo
1. Organizador abre squad activo en el dashboard
2. Ve grid de jugadores vs juegos
3. Ingresa puntuación (0-300) por jugador por juego
4. API valida, calcula handicap, recalcula standings
5. Standings actualizadas se emiten vía WebSocket
6. Todos los clientes conectados reciben la actualización

## API
- `squad.enterScore(tournamentPlayerId, gameNumber, score, pins[])`
- `squad.batchEnterScores(scores: [{tournamentPlayerId, gameNumber, score, pins}])`
- `squad.getScoreSheet(squadId)` — grid completo para edición

## Web
- Score sheet grid: filas = jugadores, columnas = juegos
- Edición inline (click en celda, teclear, Enter)
- Validación: score 0-300, handicap auto-calculado
- Último juego muestra total raw + total con handicap
- Botón de batch save o auto-save por celda

## Reglas de negocio
- Un juego no puede editarse si el siguiente juego ya tiene score (proteger integridad, permitir override con confirmación)
- Un juego con score no puede eliminarse, solo editarse
- Handicap se recalcula automáticamente al cambiar el score
- Si scoringType = 'scratch', handicap = 0 siempre

## WebSocket Events
- Al entrar: servidor envía score sheet actual
- Al actualizar score: servidor envía score_updated + standings_update
- El cliente web debe aplicar el diff, no recargar toda la página

## Files
- `apps/api/src/routers/squad.ts`
- `apps/api/src/services/score.service.ts`
- `apps/web/src/app/dashboard/tournaments/[id]/squads/[squadId]/scores/page.tsx`
