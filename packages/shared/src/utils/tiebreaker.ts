import type { StandingsEntry } from '../types'

export type TiebreakerRule = 'highest_game' | 'highest_series' | 'roll_off' | 'shared'

/**
 * Sort standings applying tiebreaker rules.
 * Returns a new sorted array with corrected ranks.
 */
export function applyTiebreaker(
  entries: StandingsEntry[],
  rule: TiebreakerRule,
): StandingsEntry[] {
  const sorted = [...entries].sort((a, b) => {
    // Primary sort: descending by total handicap (or raw if no handicap)
    const aTotal = a.totalHandicap ?? a.totalRaw
    const bTotal = b.totalHandicap ?? b.totalRaw
    if (bTotal !== aTotal) return bTotal - aTotal

    switch (rule) {
      case 'highest_game': {
        const aBest = a.games.length === 0 ? 0 : Math.max(...a.games.map((g) => g.rawScore))
        const bBest = b.games.length === 0 ? 0 : Math.max(...b.games.map((g) => g.rawScore))
        return bBest - aBest
      }
      case 'highest_series': {
        const aBestSeries = bestConsecutiveSeries(a.games.map((g) => g.rawScore), 2)
        const bBestSeries = bestConsecutiveSeries(b.games.map((g) => g.rawScore), 2)
        return bBestSeries - aBestSeries
      }
      case 'shared':
        return 0 // keep tied
      case 'roll_off':
        // Roll-off not computable here — keep tied, flagged as unresolved
        return 0
    }
  })

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1,
    behind: index === 0 ? 0 : getBehind(entry, sorted[0]!, rule),
  }))
}

function getBehind(entry: StandingsEntry, leader: StandingsEntry, _rule: TiebreakerRule): number {
  const aTotal = entry.totalHandicap ?? entry.totalRaw
  const bTotal = leader.totalHandicap ?? leader.totalRaw
  return bTotal - aTotal
}

function bestConsecutiveSeries(games: number[], n: number): number {
  if (games.length < n) return games.reduce((a, b) => a + b, 0)
  let max = 0
  for (let i = 0; i <= games.length - n; i++) {
    const sum = games.slice(i, i + n).reduce((a, b) => a + b, 0)
    if (sum > max) max = sum
  }
  return max
}
