import { describe, it, expect } from 'vitest'
import { calculatePayouts } from './payouts'

describe('calculatePayouts', () => {
  const defaultConfig = { payoutRatio: 0.8, rounding: 500, minPayout: 0 }

  it('distributes fairly for 8 entries at $10, 3 positions', () => {
    const result = calculatePayouts(8, 1000, 3, defaultConfig)
    expect(result.prizePool).toBe(6400)
    expect(result.payouts.length).toBe(3)
    expect(result.payouts[0]!.amount).toBeGreaterThanOrEqual(result.payouts[1]!.amount)
    expect(result.payouts[1]!.amount).toBeGreaterThanOrEqual(result.payouts[2]!.amount)
    const totalPaid = result.payouts.reduce((s, p) => s + p.amount, 0)
    expect(totalPaid).toBeLessThanOrEqual(result.prizePool)
    expect(totalPaid).toBeGreaterThan(0)
  })

  it('1st place gets more than 2nd for 2 players', () => {
    const result = calculatePayouts(2, 1000, 2, defaultConfig)
    expect(result.payouts.length).toBe(2)
    expect(result.payouts[0]!.amount).toBeGreaterThan(result.payouts[1]!.amount)
  })

  it('handles small prize pool', () => {
    const result = calculatePayouts(5, 100, 3, { payoutRatio: 0.8, rounding: 100, minPayout: 0 })
    expect(result.prizePool).toBe(400)
    expect(result.payouts.length).toBe(3)
    const totalPaid = result.payouts.reduce((s, p) => s + p.amount, 0)
    expect(totalPaid + result.remainder).toBeLessThanOrEqual(400)
  })

  it('winner takes all for single position', () => {
    const result = calculatePayouts(20, 500, 1, defaultConfig)
    expect(result.payouts.length).toBe(1)
    expect(result.payouts[0]!.amount).toBeLessThanOrEqual(8000)
  })

  it('returns empty when no entries', () => {
    const result = calculatePayouts(0, 1000, 3, defaultConfig)
    expect(result.payouts.length).toBe(0)
    expect(result.prizePool).toBe(0)
  })

  it('rounds all payouts to configured multiple', () => {
    const result = calculatePayouts(10, 1000, 3, { payoutRatio: 0.8, rounding: 1000, minPayout: 0 })
    for (const p of result.payouts) {
      expect(p.amount % 1000).toBe(0)
    }
  })

  it('rounds to $5 multiples by default', () => {
    const result = calculatePayouts(15, 1000, 5, defaultConfig)
    for (const p of result.payouts) {
      expect(p.amount % 500).toBe(0)
    }
  })

  it('remainder never exceeds rounding value across many scenarios', () => {
    for (let entries = 2; entries <= 50; entries++) {
      for (const fee of [500, 1000, 2500]) {
        for (const positions of [1, 2, 3, 5]) {
          if (positions > entries) continue
          const result = calculatePayouts(entries, fee, positions, defaultConfig)
          expect(result.remainder).toBeLessThan(defaultConfig.rounding)
          const totalPaid = result.payouts.reduce((s, p) => s + p.amount, 0)
          expect(totalPaid + result.remainder).toBeLessThanOrEqual(result.prizePool)
          expect(result.payouts.every((p) => p.amount >= 0)).toBe(true)
        }
      }
    }
  })

  it('total paid never exceeds prize pool', () => {
    const result = calculatePayouts(20, 2000, 5, defaultConfig)
    const totalPaid = result.payouts.reduce((s, p) => s + p.amount, 0)
    expect(totalPaid).toBeLessThanOrEqual(result.prizePool)
  })
})
