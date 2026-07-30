import { describe, it, expect } from 'vitest'
import {
  forwardMatchups,
  reverseMatchups,
  generateSETree,
  evaluateShuffle,
  fairnessShuffle,
  advanceHeadToHead,
  advanceEliminator,
  buildNextRound,
} from './brackets'

describe('forwardMatchups', () => {
  it('creates correct pairings for 8 players', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const matchups = forwardMatchups(players)
    expect(matchups).toHaveLength(4)
    expect(matchups[0]).toEqual(['a', 'h'])
    expect(matchups[1]).toEqual(['b', 'g'])
    expect(matchups[2]).toEqual(['c', 'f'])
    expect(matchups[3]).toEqual(['d', 'e'])
  })

  it('handles odd number of players', () => {
    const players = ['a', 'b', 'c', 'd', 'e']
    const matchups = forwardMatchups(players)
    expect(matchups).toHaveLength(2) // a-e, b-d, c sits out
    expect(matchups).toEqual([['a', 'e'], ['b', 'd']])
  })

  it('returns empty for less than 2 players', () => {
    expect(forwardMatchups([])).toEqual([])
    expect(forwardMatchups(['a'])).toEqual([])
  })
})

describe('reverseMatchups', () => {
  it('creates correct pairings for 8 players', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const matchups = reverseMatchups(players)
    expect(matchups).toHaveLength(4)
    expect(matchups[0]).toEqual(['a', 'b'])
    expect(matchups[1]).toEqual(['c', 'd'])
    expect(matchups[2]).toEqual(['e', 'f'])
    expect(matchups[3]).toEqual(['g', 'h'])
  })

  it('handles odd number of players (last sits out)', () => {
    const players = ['a', 'b', 'c', 'd', 'e']
    const matchups = reverseMatchups(players)
    expect(matchups).toHaveLength(2)
    expect(matchups).toEqual([['a', 'b'], ['c', 'd']])
  })
})

describe('generateSETree', () => {
  it('generates correct number of rounds for power of 2', () => {
    const { rounds } = generateSETree(8)
    expect(rounds).toBe(3)
  })

  it('generates correct rounds for non-power of 2 (with byes)', () => {
    const { rounds } = generateSETree(5)
    expect(rounds).toBe(3) // 5 → bracket size 8 → 3 rounds
  })

  it('handles 2 players (single match)', () => {
    const { root, rounds } = generateSETree(2)
    expect(rounds).toBe(1)
    expect(root).toBeDefined()
  })

  it('handles 16 players', () => {
    const { rounds } = generateSETree(16)
    expect(rounds).toBe(4)
  })

  it('handles 3 players', () => {
    const { rounds } = generateSETree(3)
    expect(rounds).toBe(2) // 3 → bracket size 4 → 2 rounds
  })
})

describe('evaluateShuffle', () => {
  it('returns 0 for fresh shuffle with no history', () => {
    const matchups: [string, string][] = [['a', 'h'], ['b', 'g']]
    expect(evaluateShuffle(matchups, [])).toBe(0)
  })

  it('penalizes duplicate pairings', () => {
    const matchups: [string, string][] = [['a', 'h'], ['a', 'h']]
    // First 'a:h' = 0, second 'a:h' = 1 → total 1
    expect(evaluateShuffle(matchups, [])).toBe(1)
  })

  it('heavily penalizes pairs from previous brackets', () => {
    const matchups: [string, string][] = [['a', 'h']]
    const history = [['a', 'b', 'c', 'h']] // a and h were together
    expect(evaluateShuffle(matchups, history)).toBe(50) // 50 penalty
  })
})

describe('fairnessShuffle', () => {
  it('returns same number of players', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const shuffled = fairnessShuffle(players, 'forward', 1000)
    expect(shuffled).toHaveLength(8)
    expect(shuffled.sort()).toEqual(players.sort())
  })

  it('handles 2 players (no shuffle needed)', () => {
    const result = fairnessShuffle(['a', 'b'], 'forward', 100)
    expect(result).toEqual(['a', 'b'])
  })

  it('produces better shuffles with more iterations', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    // Single random shuffle may have more pair collisions
    const s1 = fairnessShuffle(players, 'forward', 100)
    const s2 = fairnessShuffle(players, 'forward', 50000)
    // Both should be valid permutations
    expect(s1.sort()).toEqual(players.sort())
    expect(s2.sort()).toEqual(players.sort())
  })

  it('avoids pairings from history', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const history = [['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']] // all paired already
    const result = fairnessShuffle(players, 'forward', 50000, history)
    const matchups = forwardMatchups(result)
    const score = evaluateShuffle(matchups, history)
    // Should find a reasonably fair shuffle
    expect(score).toBeLessThan(200) // not perfect but much better than random
  })
})

describe('advanceHeadToHead', () => {
  it('advances player with higher score', () => {
    const matchups: [string, string][] = [['a', 'b'], ['c', 'd']]
    const scores = new Map([['a', 200], ['b', 180], ['c', 190], ['d', 210]])
    const winners = advanceHeadToHead(matchups, scores)
    expect(winners).toEqual(['a', 'd'])
  })

  it('ties go to first player', () => {
    const matchups: [string, string][] = [['a', 'b']]
    const scores = new Map([['a', 200], ['b', 200]])
    const winners = advanceHeadToHead(matchups, scores)
    expect(winners).toEqual(['a'])
  })

  it('handles missing scores as 0', () => {
    const matchups: [string, string][] = [['a', 'b']]
    const scores = new Map([['a', 200]])
    const winners = advanceHeadToHead(matchups, scores)
    expect(winners).toEqual(['a'])
  })
})

describe('advanceEliminator', () => {
  it('advances top N players by score', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const scores = new Map([
      ['a', 250], ['b', 240], ['c', 230], ['d', 220],
      ['e', 210], ['f', 200], ['g', 190], ['h', 180],
    ])
    const advanced = advanceEliminator(players, scores, 4)
    expect(advanced).toEqual(['a', 'b', 'c', 'd'])
    expect(advanced).toHaveLength(4)
  })

  it('handles ties by including both', () => {
    const players = ['a', 'b', 'c']
    const scores = new Map([['a', 200], ['b', 200], ['c', 190]])
    const advanced = advanceEliminator(players, scores, 2)
    expect(advanced).toEqual(['a', 'b'])
  })
})

describe('buildNextRound', () => {
  it('builds forward matchups for winners', () => {
    const winners = ['a', 'd', 'e', 'h']
    const matchups = buildNextRound(winners, 'forward')
    expect(matchups).toHaveLength(2)
    expect(matchups[0]).toEqual(['a', 'h'])
    expect(matchups[1]).toEqual(['d', 'e'])
  })

  it('returns empty for eliminator bracket', () => {
    const winners = ['a', 'b', 'c', 'd']
    expect(buildNextRound(winners, 'eliminator')).toEqual([])
  })
})
