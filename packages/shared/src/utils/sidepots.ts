import { calculateHandicap } from './handicap'

export interface PlayerScore {
  playerId: string
  scores: number[]       // scores por game
  average: number
  handicapConfig?: { base: number; percentage: number; max: number | null }
}

export interface SidepotResult {
  winners: Array<{ playerId: string; score: number; prize: number }>
  entries: number
  prizePool: number
}

/**
 * Calcula el ganador de un High Game.
 * Se considera un game específico (gameNumber, 1-indexed).
 */
export function calculateHighGame(
  entries: PlayerScore[],
  gameNumber: number,
  handicap: boolean,
  handicapConfig?: { base: number; percentage: number; max: number | null },
): SidepotResult {
  const withScores = entries.map((e) => {
    const rawScore = e.scores[gameNumber - 1] ?? 0
    const hcp = handicap && handicapConfig
      ? calculateHandicap(e.average, handicapConfig)
      : 0
    return {
      playerId: e.playerId,
      score: rawScore + hcp,
      rawScore,
    }
  }).sort((a, b) => b.score - a.score)

  const bestScore = withScores[0]?.score ?? 0
  const winners = withScores.filter((e) => e.score === bestScore)

  return {
    winners: winners.map((w) => ({ playerId: w.playerId, score: w.score, prize: 0 })),
    entries: entries.length,
    prizePool: 0, // prize pool set externally
  }
}

/**
 * Calcula el ganador de un High Series (suma de todos los juegos).
 */
export function calculateHighSeries(
  entries: PlayerScore[],
  gamesIncluded: number[],  // qué juegos incluir (1-indexed)
  handicap: boolean,
  handicapConfig?: { base: number; percentage: number; max: number | null },
): SidepotResult {
  const withScores = entries.map((e) => {
    const totalRaw = gamesIncluded.reduce((sum, g) => sum + (e.scores[g - 1] ?? 0), 0)
    const hcp = handicap && handicapConfig
      ? calculateHandicap(e.average, handicapConfig) * gamesIncluded.length
      : 0
    return {
      playerId: e.playerId,
      score: totalRaw + hcp,
    }
  }).sort((a, b) => b.score - a.score)

  const bestScore = withScores[0]?.score ?? 0
  const winners = withScores.filter((e) => e.score === bestScore)

  return {
    winners: winners.map((w) => ({ playerId: w.playerId, score: w.score, prize: 0 })),
    entries: entries.length,
    prizePool: 0,
  }
}

/**
 * Calcula los que avanzan en un eliminator después de un juego.
 * Elimina los bottom N, avanzan los top N.
 */
export function calculateEliminatorCut(
  entries: PlayerScore[],
  gameNumber: number,
  advanceCount: number,
  handicap: boolean,
  handicapConfig?: { base: number; percentage: number; max: number | null },
): { advancing: string[]; eliminated: string[] } {
  const withScores = entries.map((e) => {
    const raw = e.scores[gameNumber - 1] ?? 0
    const hcp = handicap && handicapConfig
      ? calculateHandicap(e.average, handicapConfig)
      : 0
    return { playerId: e.playerId, score: raw + hcp }
  }).sort((a, b) => b.score - a.score)

  const advancing = withScores.slice(0, advanceCount).map((e) => e.playerId)
  const eliminated = withScores.slice(advanceCount).map((e) => e.playerId)

  return { advancing, eliminated }
}

/**
 * Genera parejas aleatorias para Blind Draw Doubles.
 * No repite jugadores. Si hay impar, uno queda fuera.
 */
export function generateBlindDrawPairs(players: string[]): [string, string][] {
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  const pairs: [string, string][] = []
  for (let i = 0; i < shuffled.length - 1; i += 2) {
    pairs.push([shuffled[i]!, shuffled[i + 1]!])
  }
  return pairs
}

/**
 * Big Dog: mejor score individual del torneo (cualquier game).
 * Opcional: Woman Big Dog filtrado por género.
 */
export function calculateBigDog(
  entries: PlayerScore[],
): SidepotResult {
  const best = entries
    .map((e) => ({
      playerId: e.playerId,
      score: Math.max(...e.scores),
    }))
    .sort((a, b) => b.score - a.score)

  const bestScore = best[0]?.score ?? 0
  const winners = best.filter((e) => e.score === bestScore)

  return {
    winners: winners.map((w) => ({ playerId: w.playerId, score: w.score, prize: 0 })),
    entries: entries.length,
    prizePool: 0,
  }
}
