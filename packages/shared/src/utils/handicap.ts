export interface HandicapConfig {
  base: number
  percentage: number
  max: number | null
}

/**
 * Calculate handicap for a player given their average and tournament config.
 * Standard USBC formula: (base - avg) * percentage
 * Example: base=220, avg=185, percentage=80
 *   => (220 - 185) * 0.80 = 28 pins per game
 */
export function calculateHandicap(average: number, config: HandicapConfig): number {
  const raw = (config.base - average) * (config.percentage / 100)
  const handicap = Math.max(0, Math.round(raw))
  if (config.max !== null) {
    return Math.min(handicap, config.max)
  }
  return handicap
}

/**
 * Calculate total score with handicap applied.
 */
export function totalWithHandicap(rawScore: number, handicapPerGame: number, games: number): number {
  return rawScore + handicapPerGame * games
}
