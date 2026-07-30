# Prompt: Bracket Management

## Goal
Allow organizers to create bracket pools, shuffle players, run rounds, and pay out winners. Players see their brackets in real-time.

## Flujo
1. Organizador crea un bracket pool (nombre, precio, tipo, max jugadores)
2. Players se inscriben en el pool (online o en persona)
3. Organizador hace shuffle (50K fairness algorithm)
4. Brackets se generan y muestran matchups
5. Organizador ingresa scores de cada match
6. Sistema avanza ganadores automáticamente
7. Al finalizar, sistema calcula payouts

## API
- `bracket.createPool(input)` — crea pool
- `bracket.joinPool(poolId)` — jugador se inscribe
- `bracket.shuffle(poolId)` — shuffle + generar matches ronda 1
- `bracket.enterScore(matchId, player1Score, player2Score)` — resultado del match
- `bracket.advanceRound(poolId)` — avanza a siguiente ronda
- `bracket.getBracket(poolId)` — bracket completo con todos los matches
- `bracket.getAliveList(poolId)` — jugadores still alive
- `bracket.payOut(poolId)` — calcular y marcar pagos

## Web (Organizador)
- Lista de bracket pools del torneo
- Crear pool (modal o página)
- Pool detail: players in, shuffle button, bracket tree
- Match entry: click en match, ingresar scores
- Alive list + payout report

## Web/Mobile (Jugador)
- Mis brackets: lista de pools en los que estoy inscrito
- Bracket tree: ver mi matchup y posibles oponentes
- Still alive status

## Algoritmo de Shuffle
- 50K iteraciones para minimizar duplicación de oponentes
- Cada iteración: shuffle aleatorio, calcular penalización por pares repetidos
- Seleccionar el shuffle con menor penalización
- Implementar en `@bowling/shared/src/utils/brackets.ts`

## Brackets Soportados
- 8-person, forward (1v8, 2v7, 3v6, 4v5)
- 8-person, reverse (1v2, 3v4, 5v6, 7v8)
- Single elimination (tree, 4-64 players)
- Double elimination (winners + losers bracket)

## Files
- `packages/shared/src/utils/brackets.ts` + `brackets.test.ts`
- `apps/api/src/routers/bracket.ts`
- `apps/web/src/app/dashboard/tournaments/[id]/brackets/page.tsx`
- `apps/mobile/src/app/brackets.tsx`
