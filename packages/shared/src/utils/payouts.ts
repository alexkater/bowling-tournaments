export interface PayoutConfig {
  payoutRatio: number    // 0.0 - 1.0
  rounding: number       // en cents (500 = $5, 1000 = $10)
  minPayout: number
}

export interface Payout {
  position: number
  amount: number
}

export interface PayoutResult {
  payouts: Payout[]
  prizePool: number
  remainder: number
}

/**
 * Distribuye el prize pool usando pesos lineales descendentes.
 *
 * Para N posiciones, pesos = [N, N-1, ..., 1]
 * Así la posición 1 recibe N/(suma) del pool, posición 2 recibe (N-1)/(suma), etc.
 *
 * Luego redondea hacia abajo y redistribuye el sobrante desde la cima.
 */
export function calculatePayouts(
  totalEntries: number,
  entryFee: number,
  positions: number,
  config: PayoutConfig,
): PayoutResult {
  const grossPool = totalEntries * entryFee
  const prizePool = Math.round(grossPool * config.payoutRatio)

  if (prizePool <= 0 || positions <= 0 || totalEntries <= 0) {
    return { payouts: [], prizePool: 0, remainder: 0 }
  }

  if (positions === 1) {
    const amount = Math.floor(prizePool / config.rounding) * config.rounding
    return { payouts: [{ position: 1, amount }], prizePool, remainder: prizePool - amount }
  }

  const weights = Array.from({ length: positions }, (_, i) => positions - i)
  const totalWeight = weights.reduce((a, b) => a + b, 0)

  const rounded = weights.map((w) => {
    const raw = (prizePool * w) / totalWeight
    const roundingVal = config?.rounding ?? 500
    const minVal = config?.minPayout ?? 0
    const r = Math.floor(raw / roundingVal) * roundingVal
    return Math.max(r, minVal)
  })

  let totalPaid = rounded.reduce((a, b) => a + b, 0)
  let remainder = prizePool - totalPaid

  for (let i = 0; i < positions && remainder >= config.rounding; i++) {
    const current = rounded[i]
    if (current !== undefined) {
      rounded[i] = current + config.rounding
      remainder -= config.rounding
    }
  }

  return {
    payouts: rounded.map((amount, i) => ({ position: i + 1, amount })),
    prizePool,
    remainder,
  }
}
