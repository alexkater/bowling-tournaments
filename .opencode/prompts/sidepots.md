# Prompt: Sidepots

## Goal
Manage sidepots: high game, high series, eliminators, Big Dog, Blind Draw, with auto-calculated payouts.

## Tipos de Sidepot

### High Game / High Series
- Jugador paga entry fee
- Gana el que tenga el score más alto en un juego específico (o serie)
- Soporte scratch + handicap
- Se puede limitar por género

### Eliminator
- Jugadores compiten en X juegos
- Después de cada juego, los N scores más bajos son eliminados (auto cut-line)
- Últimos X en pie ganan premio

### Big Dog
- Entra todo el pool de jugadores
- El score más alto del torneo gana
- Big Dog femenino separado si aplica

### Blind Draw Doubles
- Se sortean parejas aleatorias al final del torneo
- La suma de scores de la pareja compite contra otras parejas
- Los jugadores no saben quién es su pareja hasta el sorteo

## API
- `sidepot.create(input)` — crear sidepot
- `sidepot.join(sidepotId)` — jugador se inscribe
- `sidepot.getResults(sidepotId)` — resultados actuales
- `sidepot.calculatePayouts(sidepotId)` — calcular pagos

## Cálculo de Payouts
- Porcentaje de payout configurable (default 80%)
- Smart payout con decaimiento geométrico:
  - 1er lugar: 40% del prize pool
  - 2do lugar: 25%
  - 3er lugar: 15%
  - Resto: distribución decreciente
- Redondeo a $5/$10 más cercano

## Files
- `apps/api/src/routers/sidepot.ts`
- `apps/api/src/services/payout.service.ts`
- `packages/shared/src/utils/payouts.ts` + test
- `apps/web/src/app/dashboard/tournaments/[id]/sidepots/page.tsx`
