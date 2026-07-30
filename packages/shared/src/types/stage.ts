// ============================================================
// Stage Format — cada etapa del torneo tiene un formato
// ============================================================

export type StageFormatType =
  | 'total_pins'        // X juegos, total de pines gana
  | 'match_play'        // Enfrentamientos directos, puntos por win
  | 'bracket'           // Árbol de eliminación (single/double/eliminator)
  | 'stepladder'        // Top X finalistas en eliminatoria
  | 'baker'             // Equipo rotativo (5 players)
  | 'round_robin'       // Todos contra todos
  | 'best_score'        // Mejor score de N intentos (sweeper)

// Scoring base
export interface ScoringConfig {
  type: 'scratch' | 'handicap'
  handicapBase?: number
  handicapPercentage?: number
  handicapMax?: number | null
  noTap: boolean          // 9-count = strike
  // pinsOverAverage: eliminado en MVP. Solo handicap USBC estándar.
}

// ---- Format-specific configs ----

export interface TotalPinsConfig {
  type: 'total_pins'
  gamesPerPlayer: number
  eventType: EventType
  scoring: ScoringConfig
}

export interface MatchPlayConfig {
  type: 'match_play'
  rounds: number
  pointsForWin: number     // normalmente 1
  pointsForTie: number     // normalmente 0.5
  pointsForLoss: number    // normalmente 0
  scoring: ScoringConfig
}

export interface BracketConfig {
  type: 'bracket'
  bracketType: 'single_elimination' | 'double_elimination' | 'eliminator_bracket'
  bracketSize: number       // 4, 8, 16, 32, 64
  seeding: 'random' | 'by_qualifying' | 'by_average'
  scoring: ScoringConfig
  eliminatorConfig?: {
    rounds: number          // ej: 3 rondas (8→4→2→1)
    advancePerRound: number // ej: top 4 avanzan en ronda 1
    gamesPerRound: number   // juegos por ronda (normalmente 1)
  }
}

export interface StepladderConfig {
  type: 'stepladder'
  positions: 4 | 5          // Top 4 o Top 5
  scoring: ScoringConfig
  matchLength: number       // juegos por match (normalmente 1)
}

export interface BakerConfig {
  type: 'baker'
  gamesPerMatch: number
  playersPerTeam: number    // normalmente 5
  scoring: ScoringConfig
}

export interface RoundRobinConfig {
  type: 'round_robin'
  gamesPerMatch: number
  pointsForWin: number
  pointsForTie: number
  scoring: ScoringConfig
}

export interface BestScoreConfig {
  type: 'best_score'
  gamesPerAttempt: number
  maxAttempts: number       // cuántos squads puede comprar
  scoring: ScoringConfig
}

export type StageFormatConfig =
  | TotalPinsConfig
  | MatchPlayConfig
  | BracketConfig
  | StepladderConfig
  | BakerConfig
  | RoundRobinConfig
  | BestScoreConfig

// ============================================================
// Advancement — cómo se pasa de una etapa a la siguiente
// ============================================================

export type AdvancementType =
  | 'cut_line'          // Top N avanzan
  | 'all_advance'       // Todos continúan, scores se arrastran o no
  | 'bracket_seeding'   // Se siembran en bracket según orden de qualifying
  | 'final'             // Última etapa, no hay avance

export interface CutLineAdvancement {
  type: 'cut_line'
  advanceCount: number
  tiebreaker: 'highest_game' | 'highest_series' | 'roll_off' | 'shared'
  label?: string           // "Top 16", "Top 4"
}

export interface AllAdvancement {
  type: 'all_advance'
  carryScores: boolean     // si los scores se arrastran a la siguiente etapa
}

export interface BracketSeedingAdvancement {
  type: 'bracket_seeding'
  seedCount: number
  seedBy: 'qualifying_order' | 'average'
}

export interface FinalAdvancement {
  type: 'final'
}

export type AdvancementConfig =
  | CutLineAdvancement
  | AllAdvancement
  | BracketSeedingAdvancement
  | FinalAdvancement

// ============================================================
// Stage — una etapa del torneo
// ============================================================

export interface Stage {
  id: string
  tournamentId: string
  name: string               // "Qualifying", "Match Play", "Finals"
  order: number              // posición en el torneo (0, 1, 2...)
  format: StageFormatConfig
  advancement: AdvancementConfig
  squadConfig: SquadConfig | null
}

/**
 * Configuración de squads para una etapa.
 * count > 1 significa múltiples squads (horarios diferentes).
 * standingsScope define si los scores de distintos squads se combinan
 * en una sola clasificación o son independientes.
 */
export interface SquadConfig {
  label: string              // "Squad A", "Squad B"
  count: number
  allowReEntry: boolean      // si se permite comprar múltiples squads
  standingsScope: 'per_squad' | 'combined'  // cómo se combinan los scores entre squads
}

// ============================================================
// Event types
// ============================================================

export type EventType = 'singles' | 'doubles' | 'trios' | 'teams' | 'all_events'
