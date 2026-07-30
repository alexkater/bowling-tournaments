# Domain Core — El Corazón del Producto

La UI se puede cambiar. La API se puede reescribir. La base de datos se puede migrar.
**El motor de cálculos y el modelo de datos es el foso competitivo.**

Todo en `packages/shared/src/` — cero dependencias externas, funciones puras, 100% testable.

## Principios

1. **Pure functions everywhere**. Handicap, brackets, payouts, tiebreakers — funciones sin side effects.
2. **Zero framework dependencies**. No importa nada de API, DB, React, Express. Solo TypeScript + Zod.
3. **100% test coverage** en todos los casos documentados, incluyendo property-based tests.
4. **Types first**. Los tipos del dominio se definen primero. Todo lo demás deriva de ellos.
5. **Independencia de módulos**. Cada engine es autónomo. handicap.ts no importa brackets.ts.

## Módulos

### Handicap Engine
```ts
calculateHandicap(average: number, config: HandicapConfig): number
totalWithHandicap(rawScore: number, handicapPerGame: number, games: number): number
```

### Tiebreaker Engine
```ts
applyTiebreaker(entries: StandingsEntry[], rule: TiebreakerRule): StandingsEntry[]
```

### Bracket Engine (el más complejo)
```ts
shufflePlayers(players: string[], config: ShuffleConfig): BracketMatchup[]
generateBracketTree(players: string[], type: BracketType): BracketMatch[]
advanceRound(matches: BracketMatch[], winners: string[]): BracketMatch[]
```

### Payout Engine
```ts
calculatePayouts(prizePool: number, positions: number, config: PayoutConfig): Payout[]
```

### State Machine
```ts
transition(current: Status, target: Status): Status  // lanza error si inválido
getValidTransitions(current: Status): Status[]
```

### Sidepot Engine
```ts
calculateHighGameWinner(...)
calculateEliminatorCut(...)
calculateBlindDrawPairs(...)
```

## Por qué esto es el foso

**Cada función pura es una unidad de negocio que podemos probar aisladamente.** Cuando un organizador se queje de que un payout está mal, no necesitamos abrir la app — vamos directo al test, vemos qué caso falta, lo añadimos, arreglamos, y tenemos la seguridad de que no se vuelve a romper.

**Esto también habilita estadísticas desde cualquier ángulo.** Cada juego, frame, bracket, sidepot y transacción queda registrado con tipos precisos. Puedes pivotar para responder cosas como:
- ¿Qué jugador tiene el mejor average en torneos con handicap vs scratch?
- ¿Qué centro genera más inscripciones en brackets?
- ¿Qué formato de torneo tiene más retención de jugadores?
- ¿Qué mes del año concentra más torneos?

Todo eso es posible porque los datos están bien modelados desde el día 1.
