# Domain Validation Rules

Reglas de validación que el sistema debe aplicar al crear/modificar torneos.

## Tournament Validation

### Stages
- [ ] Al menos 1 stage por torneo
- [ ] El último stage debe tener `advancement.type === 'final'`
- [ ] Ningún stage no-final puede tener `advancement.type === 'final'`
- [ ] `stage.order` debe ser secuencial (0, 1, 2...) y coincidir con la posición en el array
- [ ] Los nombres de stage deben ser únicos dentro del torneo

### Stage → Format Compatibility
- [ ] `stepladder` format solo puede ser el último stage (su advancement debe ser `final`)
- [ ] `bracket` format con `bracketType: 'eliminator_bracket'` debe tener `eliminatorConfig` definido
- [ ] `bracket` format con `bracketType: 'single_elimination' | 'double_elimination'` no debe tener `eliminatorConfig`
- [ ] `best_score` format con `maxAttempts === 1` es equivalente a `total_pins` (no blocker, warning)

### Advancement → Previous Stage Compatibility
- [ ] `bracket_seeding` advancement solo puede venir después de `total_pins`, `best_score`, o `round_robin`
- [ ] `cut_line` advancement: `advanceCount` debe ser menor que el número de jugadores esperados
- [ ] `all_advance` con `carryScores: true`: la siguiente stage debe tener `total_pins` format (los scores se arrastran para combinarse)

### Squad Config
- [ ] Si `squadConfig.count > 1` y `standingsScope === 'combined'`, el advancement `cut_line` aplica sobre la clasificación combinada
- [ ] Si `squadConfig.count > 1` y `standingsScope === 'per_squad'`, el advancement `cut_line` aplica por squad individual
- [ ] `allowReEntry: true` solo es válido si el format es `total_pins` o `best_score` (no tiene sentido en match_play, bracket, etc.)

### Scoring Config
- [ ] `noTap: true` fuerza que 9 count = strike (solo aplica si el sistema de scoring lo soporta)
- [ ] Si `type === 'scratch'`, `handicapBase`, `handicapPercentage`, `handicapMax` son ignorados
- [ ] Si `type === 'handicap'`, se requiere handicapBase (default 220) y percentage (default 80)

### Tournament Dates
- [ ] `registrationDeadline` debe ser anterior a `startDate`
- [ ] `startDate` debe ser anterior a `endDate`
- [ ] Un torneo `published` no puede tener `startDate` en el pasado
- [ ] Un torneo `in_progress` debe tener `startDate <= now <= endDate`
