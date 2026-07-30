import { describe, it, expect } from 'vitest'
import { calculateHandicap, totalWithHandicap } from './handicap'

describe('calculateHandicap', () => {
  it('calculates standard handicap correctly', () => {
    expect(calculateHandicap(185, { base: 220, percentage: 80, max: null })).toBe(28)
  })

  it('returns 0 when average equals base', () => {
    expect(calculateHandicap(220, { base: 220, percentage: 80, max: null })).toBe(0)
  })

  it('returns 0 when average exceeds base (scratch equivalent)', () => {
    expect(calculateHandicap(230, { base: 220, percentage: 80, max: null })).toBe(0)
  })

  it('caps handicap at max when configured', () => {
    expect(calculateHandicap(100, { base: 220, percentage: 100, max: 50 })).toBe(50)
  })

  it('does not cap when max is null', () => {
    expect(calculateHandicap(100, { base: 220, percentage: 100, max: null })).toBe(120)
  })

  it('rounds to nearest integer', () => {
    // (220 - 183) * 0.80 = 29.6 → round → 30
    expect(calculateHandicap(183, { base: 220, percentage: 80, max: null })).toBe(30)
  })

  it('rounds down correctly', () => {
    // (220 - 184) * 0.80 = 28.8 → round → 29
    expect(calculateHandicap(184, { base: 220, percentage: 80, max: null })).toBe(29)
  })

  it('handles 50% percentage', () => {
    expect(calculateHandicap(200, { base: 220, percentage: 50, max: null })).toBe(10)
  })

  it('handles 100% percentage', () => {
    expect(calculateHandicap(200, { base: 220, percentage: 100, max: null })).toBe(20)
  })

  it('returns 0 when max is 0 (no handicap allowed)', () => {
    expect(calculateHandicap(150, { base: 220, percentage: 80, max: 0 })).toBe(0)
  })

  it('handles max cap lower than calculated handicap', () => {
    // (220 - 190) * 0.80 = 24, cap at 10
    expect(calculateHandicap(190, { base: 220, percentage: 80, max: 10 })).toBe(10)
  })

  it('handles max cap higher than calculated handicap (no effect)', () => {
    // (220 - 210) * 0.80 = 8, cap at 20 → 8
    expect(calculateHandicap(210, { base: 220, percentage: 80, max: 20 })).toBe(8)
  })

  it('handles average of 0 (new bowler, maximum handicap)', () => {
    expect(calculateHandicap(0, { base: 220, percentage: 100, max: null })).toBe(220)
    expect(calculateHandicap(0, { base: 220, percentage: 80, max: null })).toBe(176)
  })

  it('is never negative for any input', () => {
    const inputs = [
      { avg: 0, base: 220, pct: 100, max: null },
      { avg: 50, base: 200, pct: 90, max: 100 },
      { avg: 300, base: 220, pct: 80, max: null },
      { avg: 185, base: 220, pct: 80, max: 30 },
    ]
    for (const { avg, base, pct, max } of inputs) {
      expect(calculateHandicap(avg, { base, percentage: pct, max })).toBeGreaterThanOrEqual(0)
    }
  })

  it('handles different base values', () => {
    expect(calculateHandicap(180, { base: 200, percentage: 80, max: null })).toBe(16)
    expect(calculateHandicap(180, { base: 210, percentage: 80, max: null })).toBe(24)
  })
})

describe('totalWithHandicap', () => {
  it('adds handicap per game correctly', () => {
    expect(totalWithHandicap(600, 10, 3)).toBe(630)
  })

  it('returns raw score when handicap is 0', () => {
    expect(totalWithHandicap(600, 0, 3)).toBe(600)
  })

  it('handles different game counts', () => {
    expect(totalWithHandicap(1200, 10, 6)).toBe(1260)
    expect(totalWithHandicap(400, 15, 2)).toBe(430)
  })

  it('handles single game', () => {
    expect(totalWithHandicap(200, 10, 1)).toBe(210)
  })
})
