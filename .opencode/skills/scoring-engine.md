# Skill: Scoring Engine — Implementar puntuaciones y clasificaciones

## Cuándo usarlo
Cada vez que necesites implementar cálculo de puntuaciones, handicap, clasificaciones o tiebreakers.

## Handicap
Fórmula estándar USBC (ya implementada en `@bowling/shared/src/utils/handicap.ts`):
```
handicap = max(0, round((base - avg) * percentage / 100))
total = rawScore + handicap * games
```

## Tiebreakers
- `highest_game`: mejor juego individual
- `highest_series`: mejor serie consecutiva de 2 juegos
- `roll_off`: no computable, marcar como empate para decisión presencial
- `shared`: mantener empate (ej: premio compartido)

## Clasificaciones en vivo
1. Cada vez que se ingresa una puntuación:
   a. Validar puntuación (0-300 por juego, 0-10 por roll)
   b. Calcular handicap
   c. Recalcular standings del squad
   d. Emitir vía WebSocket a todos los clientes conectados
2. Las standings se cachean en memoria con un TTL de 5s
3. Broadcast diferencial: solo enviar cambios, no la lista completa siempre

## Estructura de datos WebSocket
```ts
// Mensaje del servidor al cliente
{
  type: 'standings_update',
  tournamentId: string,
  squadId: string,
  eventType: 'singles' | 'doubles' | ...,
  standings: StandingsEntry[]
}

// Mensaje del servidor al cliente (cambio parcial)
{
  type: 'score_updated',
  tournamentId: string,
  playerId: string,
  gameNumber: number,
  newScore: number,
}
```
