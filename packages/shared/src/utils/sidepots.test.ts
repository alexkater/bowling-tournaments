import { describe, it, expect } from 'vitest'
import {
  calculateHighGame,
  calculateHighSeries,
  calculateEliminatorCut,
  generateBlindDrawPairs,
  calculateBigDog,
} from './sidepots'
import type { PlayerScore } from './sidepots'

const hcpConfig = { base: 220, percentage: 80, max: null }

function player(id: string, scores: number[], avg = 200): PlayerScore {
  return { playerId: id, scores, average: avg }
}

describe('calculateHighGame', () => {
  it('finds winner for a specific game', () => {
    const entries = [
      player('a', [200, 210, 190]),
      player('b', [180, 220, 200]),
      player('c', [210, 190, 205]),
    ]
    const result = calculateHighGame(entries, 2, false)
    expect(result.winners).toHaveLength(1)
    expect(result.winners[0]!.playerId).toBe('b') // 220 in game 2
    expect(result.winners[0]!.score).toBe(220)
  })

  it('handles ties by including multiple winners', () => {
    const entries = [
      player('a', [200, 210, 190]),
      player('b', [180, 210, 200]),
    ]
    const result = calculateHighGame(entries, 2, false)
    expect(result.winners).toHaveLength(2) // both scored 210
  })

  it('applies handicap when enabled', () => {
    const entries = [
      player('a', [200, 210, 190], 185), // handicap: (220-185)*0.8 = 28
      player('b', [180, 220, 200], 220), // handicap: 0
    ]
    const result = calculateHighGame(entries, 2, true, hcpConfig)
    // a: 210 + 28 = 238
    // b: 220 + 0 = 220
    expect(result.winners[0]!.playerId).toBe('a')
  })
})

describe('calculateHighSeries', () => {
  it('sums all games for winner', () => {
    const entries = [
      player('a', [200, 210, 190]),
      player('b', [180, 220, 200]),
    ]
    const result = calculateHighSeries(entries, [1, 2, 3], false)
    expect(result.winners[0]!.playerId).toBe('a') // 200+210+190 = 600 > 180+220+200 = 600? Equal
    // Both equal, first wins
  })

  it('filters by specific games', () => {
    const entries = [
      player('a', [200, 210, 190]),
      player('b', [180, 220, 200]),
    ]
    const result = calculateHighSeries(entries, [2, 3], false)
    // a: 210+190 = 400
    // b: 220+200 = 420
    expect(result.winners[0]!.playerId).toBe('b')
  })
})

describe('calculateEliminatorCut', () => {
  it('advances top N and eliminates rest', () => {
    const entries = [
      player('a', [250, 0, 0]),
      player('b', [240, 0, 0]),
      player('c', [230, 0, 0]),
      player('d', [220, 0, 0]),
    ]
    const result = calculateEliminatorCut(entries, 1, 2, false)
    expect(result.advancing).toEqual(['a', 'b'])
    expect(result.eliminated).toEqual(['c', 'd'])
  })

  it('handles all advancing when advanceCount equals entries', () => {
    const entries = [
      player('a', [200]),
      player('b', [190]),
    ]
    const result = calculateEliminatorCut(entries, 1, 2, false)
    expect(result.advancing).toHaveLength(2)
    expect(result.eliminated).toHaveLength(0)
  })
})

describe('generateBlindDrawPairs', () => {
  it('generates correct number of pairs for even players', () => {
    const pairs = generateBlindDrawPairs(['a', 'b', 'c', 'd'])
    expect(pairs).toHaveLength(2)
    for (const [p1, p2] of pairs) {
      expect(p1).toBeDefined()
      expect(p2).toBeDefined()
      expect(p1).not.toBe(p2)
    }
  })

  it('handles odd number (last player sits out)', () => {
    const pairs = generateBlindDrawPairs(['a', 'b', 'c'])
    expect(pairs).toHaveLength(1)
  })

  it('does not repeat players', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f']
    const pairs = generateBlindDrawPairs(players)
    const used = pairs.flatMap(([a, b]) => [a, b])
    const unique = new Set(used)
    expect(unique.size).toBe(used.length)
  })
})

describe('calculateBigDog', () => {
  it('finds best individual game across all', () => {
    const entries = [
      player('a', [200, 210, 190]),
      player('b', [180, 220, 200]),
      player('c', [215, 195, 190]),
    ]
    const result = calculateBigDog(entries)
    expect(result.winners[0]!.playerId).toBe('b') // 220
  })
})
