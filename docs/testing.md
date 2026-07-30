# Testing Strategy

## Filosofía

El core de la aplicación son los **cálculos matemáticos y reglas de negocio** del bowling:
handicap, brackets, payouts, tiebreakers, transiciones de estado. La UI es secundaria.

**Prioridad: domain logic > integration > E2E > visual**

Cada bug en producción → primero test que lo reproduce, luego fix.

---

## 1. Unit Tests — Prioridad Absoluta

### Handicap Engine

Fórmula: `max(0, round((base - avg) * percentage / 100))`

| Caso | Input | Esperado |
|---|---|---|
| Jugador promedio (avg 185, base 220, 80%) | 185, {base:220, pct:80, max:null} | 28 |
| Scratch (avg 220+, cualquier base) | 230, {base:220, pct:80, max:null} | 0 |
| Handicap máximo cap | avg 100, {base:220, pct:100, max:50} | 50 (cap) |
| Sin cap | avg 100, {base:220, pct:100, max:null} | 120 |
| Handicap cero por average alto | avg 220, {base:220, pct:80, max:null} | 0 |
| Redondeo correcto | avg 183, {base:220, pct:80, max:null} | 30 |
| Porcentaje 50% | avg 200, {base:220, pct:50, max:null} | 10 |
| Porcentaje 100% | avg 200, {base:220, pct:100, max:null} | 20 |
| max=0 (sin handicap permitido) | avg 150, {base:220, pct:80, max:0} | 0 |
| Handicap con sidepot (config independiente) | config diferente al torneo | usa config del sidepot |
| Sin average registrado | null, {base:220, pct:80, max:null} | usar default del torneo |

### Tiebreaker Engine

| Caso | Input | Esperado |
|---|---|---|
| highest_game: mismo total, gana mejor juego | A: 600 {200,210,190}, B: 600 {180,220,200} | B gana (220 > 210) |
| highest_series: misma total, gana mejor serie 2 juegos | A: 600 {200,210,190}, B: 600 {180,220,200} | B gana (220+200=420 > 210+200=410) |
| 3 juegos empatados | A: 600 {200,200,200}, B: 600 {200,200,200} | empate |
| shared: mantiene empate | cualquiera | mismo rank |
| roll_off: no computable | cualquiera | tied flag, no resuelve |
| 3+ jugadores empatados | múltiples combinaciones | correcto orden después del tiebreaker |
| Todos con mismo mejor juego | scenario | cae a segundo tiebreaker |
| Un jugador sin juegos registrados | entrada parcial | no crash |

### State Machine — Torneo

Transiciones válidas:
```
draft → published
draft → cancelled
published → in_progress
published → cancelled
in_progress → completed
in_progress → cancelled
```

Transiciones inválidas (deben lanzar error):
```
cancelled → cualquier estado
completed → cualquier estado
published → draft
in_progress → published
draft → completed (saltarse published)
```

### State Machine — Bracket Pool
```
open → shuffling
shuffling → in_progress
in_progress → completed
```

### Stage Combinations — Multi-Stage Torneos

| Escenario | Stages | Avance |
|---|---|---|
| Torneo simple, 3 games | Stage 1: total_pins | final |
| Qual → Match Play → Stepladder | Stage 1: total_pins, Stage 2: match_play, Stage 3: stepladder | cut_line → cut_line → final |
| Eliminator bracket como torneo principal | Stage 1: bracket (eliminator_bracket) | final |
| Single elim como torneo principal | Stage 1: bracket (single_elimination) | final |
| Double elim como torneo principal | Stage 1: bracket (double_elimination) | final |
| Sweeper: 3 squads, mejor score combinado | Stage 1: best_score, squadConfig.count=3, standingsScope=combined | final |
| All-Events (singles+doubles+teams) | Stage 1: total_pins singles, Stage 2: total_pins doubles, Stage 3: total_pins teams | all_advance (carry scores) → all_advance → final |
| Qualifying → Double elim bracket | Stage 1: total_pins, Stage 2: bracket (double_elimination) | bracket_seeding → final |
| Torneo con 2 squads separados | Stage 1: total_pins, squadConfig.count=2, standingsScope=per_squad | cut_line (top 3 per squad) → final |

### Validaciones de torneo

| Regla | Caso | Esperado |
|---|---|---|
| Último stage debe ser final | Stage sin final al final | error |
| Stage no-final no puede ser final | Stage intermedio con final | error |
| orders deben ser secuenciales | [order:0, order:2] | error |
| Mínimo 1 stage | 0 stages | error |
| stepladder solo como último stage | stepladder en stage 1 de 2 | error |
| bracket_seeding solo después de total_pins/best_score | bracket_seeding después de match_play | warning o error |

### Bracket Engine — Shuffle

Algoritmo de 50K iteraciones para minimizar pares repetidos.

| Caso | Input | Esperado |
|---|---|---|
| 8 jugadores, forward | 8 players | 4 brackets: (1v8, 2v7, 3v6, 4v5) |
| 8 jugadores, reverse | 8 players | 4 brackets: (1v2, 3v4, 5v6, 7v8) |
| 8 jugadores, eliminator | 8 players | ronda 1: todos, top 4 avanzan; ronda 2: top 2; ronda 3: winner |
| 7 jugadores (byes en forward) | 7 players | 3 brackets completos + 1 con bye |
| 7 jugadores (byes en eliminator) | 7 players | ronda 1: 7 players, top 4 avanzan |
| 16 jugadores single elim | 16 players | árbol de 4 rondas |
| 8 jugadores double elim | 8 players | winners + losers bracket |
| 50K fairness: sin duplicados | 8 players, 3 games | ningún par se repite en diferentes brackets |
| Menos de 4 jugadores | 2 players | lanza error |
| Eliminator: scores determinan avance | 8 players, scores fijos | los top 4 scores pasan, no los que ganaron un match |

### Payout Engine

Decaimiento geométrico:

| Caso | Prize Pool | Esperado |
|---|---|---|
| 8 entries, $10 c/u, 80% ratio | $64 | 1st: $25, 2nd: $16, 3rd: $10... |
| Redondeo $5 | $100 | payouts múltiplos de 5 |
| Redondeo $10 | $100 | payouts múltiplos de 10 |
| 2 jugadores | $20 | winner $16, runner-up $4 |
| Prize pool pequeño ($5) | $5 | winner $4, resto $1 |
| Custom override por posición | pool + overrides | respeta overrides |
| Sobrante por redondeo | $73 | va al fondo, no desaparece |

### Sidepot Engine

| Sidepot | Casos |
|---|---|
| High Game | 8 jugadores, game 3 más alto gana. Handicap vs scratch |
| High Series | mejor serie de juegos 1-3. Mejor serie de juegos 2-4 (configurable) |
| Eliminator | 20 jugadores, 3 juegos: eliminar bottom 4 + top 8 avanzan |
| Big Dog | score más alto absoluto. Woman Big Dog separado |
| Blind Draw Doubles | sorteo de pares, suma de scores |
| Mystery Doubles | sorteo aleatorio cada game, partner diferente |

---

## 2. Property-Based Tests

Con `fast-check` para propiedades invariantes:

```ts
// Handicap nunca es negativo
// Handicap nunca excede el cap máximo
// Suma de payouts <= prize pool total
// En single elim, (n-1) matches para n jugadores
// En double elim, máximo 2*(n-1) matches
// Shuffle 50K no produce pares duplicados
// State machine solo permite transiciones definidas
```

---

## 3. Integration Tests

Contra API real + PostgreSQL efímera (Neon branch / testcontainer).

### Flujos
1. Crear torneo → publicar → listar → obtener → cancelar
2. Torneo → registrar 8 jugadores → roster
3. Torneo → ingresar scores → standings calculados
4. Torneo → bracket pool → shuffle → avance ronda
5. Torneo → sidepot high game → calcular ganador
6. Torneo handicap → scores → standings con handicap
7. Error: registrar duplicado → CONFLICT
8. Error: score en torneo cancelado → BAD_REQUEST

---

## 4. E2E Tests (Playwright) — Web

1. Login → dashboard → crear torneo completo → ver en lista
2. Torneo published → registrar jugadores → roster
3. Torneo in_progress → ingresar scores → standings actualizados
4. Torneo → crear bracket → shuffle → ingresar resultados
5. Generar reporte PDF → descargar

---

## 5. E2E Tests (Detox) — Mobile

1. Login → ver torneos activos → detalle
2. Ver standings → buscar por nombre
3. Ver brackets → bracket tree

---

## 6. Regression Tests

**Cada bug en producción:**
1. Test que reproduce el bug → 2. Falla (rojo) → 3. Fix → 4. Pasa (verde) → 5. Commit

Especialmente crítico para: handicap incorrecto, payouts que no cuadran, transiciones inválidas permitidas, bracket advancement incorrecto.

---

## Coverage Goals

| Área | Target |
|---|---|
| Domain logic (handicap, brackets, payouts, tiebreakers) | 100% casos documentados |
| tRPC routers (integration) | 100% endpoints |
| State transitions | 100% válidas + inválidas |
| Web E2E | 5 caminos críticos |
| Mobile E2E | 3 caminos críticos |
| Regression | cada bug = 1 test |

## CI Gate
```
typecheck → unit tests → integration tests → build → (opcional: E2E)
```
Si falla cualquier unit test del domain logic → ❌ NO merge.
