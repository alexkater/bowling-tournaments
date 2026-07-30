import { describe, it, expect } from 'vitest'
import {
  validateDates,
  validateStageNames,
  validateStageOrder,
  validateLastStageIsFinal,
  validateOnlyLastStageIsFinal,
  validateStepladderOnlyLast,
  validateBracketSeedingAdvancement,
  validateTournament,
} from './validation'
import type { TournamentInput, StageInput } from './validation'

function makeStage(overrides: Partial<StageInput> = {}): StageInput {
  return {
    name: overrides.name ?? 'Qualifying',
    order: overrides.order ?? 0,
    format: overrides.format ?? {
      type: 'total_pins',
      gamesPerPlayer: 3,
      eventType: 'singles',
      scoring: { type: 'scratch', noTap: false },
    },
    advancement: overrides.advancement ?? { type: 'all_advance', carryScores: true },
  }
}

function makeFinalStage(overrides: Partial<StageInput> = {}): StageInput {
  return makeStage({
    ...overrides,
    advancement: { type: 'final' },
  })
}

function makeTournament(overrides: Partial<TournamentInput> = {}): TournamentInput {
  return {
    name: overrides.name ?? 'Test Tournament',
    startDate: overrides.startDate ?? '2026-08-01T00:00:00Z',
    endDate: overrides.endDate ?? '2026-08-03T00:00:00Z',
    registrationDeadline: overrides.registrationDeadline ?? null,
    stages: overrides.stages ?? [
      makeStage({ name: 'Qualifying', order: 0, advancement: { type: 'final' } }),
    ],
  }
}

describe('validateDates', () => {
  it('accepts valid dates', () => {
    const input = makeTournament()
    expect(validateDates(input)).toEqual([])
  })

  it('rejects startDate after endDate', () => {
    const input = makeTournament({ startDate: '2026-08-05T00:00:00Z', endDate: '2026-08-01T00:00:00Z' })
    const errors = validateDates(input)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]!.path).toBe('endDate')
  })

  it('rejects registrationDeadline after startDate', () => {
    const input = makeTournament({
      startDate: '2026-08-01T00:00:00Z',
      endDate: '2026-08-03T00:00:00Z',
      registrationDeadline: '2026-08-02T00:00:00Z',
    })
    const errors = validateDates(input)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0]!.path).toBe('registrationDeadline')
  })

  it('accepts registrationDeadline before startDate', () => {
    const input = makeTournament({ registrationDeadline: '2026-07-15T00:00:00Z' })
    expect(validateDates(input)).toEqual([])
  })

  it('rejects invalid date strings', () => {
    const input = makeTournament({ startDate: 'not-a-date' })
    const errors = validateDates(input)
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('validateStageNames', () => {
  it('accepts unique names', () => {
    const stages = [
      makeStage({ name: 'Qualifying', order: 0 }),
      makeFinalStage({ name: 'Finals', order: 1 }),
    ]
    expect(validateStageNames(stages)).toEqual([])
  })

  it('rejects duplicate names', () => {
    const stages = [
      makeStage({ name: 'Qualifying', order: 0 }),
      makeFinalStage({ name: 'Qualifying', order: 1 }),
    ]
    const errors = validateStageNames(stages)
    expect(errors.length).toBe(1)
    expect(errors[0]!.message).toContain('Duplicate')
  })
})

describe('validateStageOrder', () => {
  it('accepts sequential orders', () => {
    const stages = [
      makeStage({ order: 0 }),
      makeFinalStage({ order: 1 }),
    ]
    expect(validateStageOrder(stages)).toEqual([])
  })

  it('rejects non-sequential orders', () => {
    const stages = [
      makeStage({ order: 0 }),
      makeFinalStage({ order: 5 }),
    ]
    const errors = validateStageOrder(stages)
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('validateLastStageIsFinal', () => {
  it('requires last stage to be final', () => {
    const stages = [
      makeStage({ order: 0, advancement: { type: 'all_advance', carryScores: true } }),
    ]
    const errors = validateLastStageIsFinal(stages)
    expect(errors.length).toBe(1)
  })

  it('accept when last stage is final', () => {
    const stages = [makeFinalStage({ order: 0 })]
    expect(validateLastStageIsFinal(stages)).toEqual([])
  })

  it('returns empty for zero stages', () => {
    expect(validateLastStageIsFinal([])).toEqual([])
  })
})

describe('validateOnlyLastStageIsFinal', () => {
  it('rejects final in middle', () => {
    const stages = [
      makeFinalStage({ name: 'Q1', order: 0 }),
      makeFinalStage({ name: 'Q2', order: 1 }),
    ]
    const errors = validateOnlyLastStageIsFinal(stages)
    expect(errors.length).toBe(1)
  })

  it('accepts final only at end', () => {
    const stages = [
      makeStage({ name: 'Q1', order: 0, advancement: { type: 'all_advance', carryScores: true } }),
      makeFinalStage({ name: 'F', order: 1 }),
    ]
    expect(validateOnlyLastStageIsFinal(stages)).toEqual([])
  })
})

describe('validateStepladderOnlyLast', () => {
  it('rejects stepladder not at end', () => {
    const stages = [
      makeStage({ order: 0, format: { type: 'stepladder', positions: 4 as const, matchLength: 1, scoring: { type: 'scratch', noTap: false } } }),
      makeFinalStage({ order: 1 }),
    ]
    const errors = validateStepladderOnlyLast(stages)
    expect(errors.length).toBe(1)
  })

  it('accepts stepladder at end', () => {
    const stages = [
      makeStage({ order: 0, advancement: { type: 'all_advance', carryScores: true } }),
      makeFinalStage({ order: 1, format: { type: 'stepladder', positions: 4 as const, matchLength: 1, scoring: { type: 'scratch', noTap: false } } }),
    ]
    expect(validateStepladderOnlyLast(stages)).toEqual([])
  })
})

describe('validateBracketSeedingAdvancement', () => {
  it('rejects bracket_seeding after non-qualifying format', () => {
    const stages = [
      makeStage({ order: 0, format: { type: 'match_play', rounds: 8, pointsForWin: 1, pointsForTie: 0.5, pointsForLoss: 0, scoring: { type: 'scratch', noTap: false } } }),
      makeStage({ name: 'Bracket', order: 1, advancement: { type: 'bracket_seeding', seedCount: 8, seedBy: 'qualifying_order' }, format: { type: 'bracket', bracketType: 'single_elimination' as const, bracketSize: 8 as const, seeding: 'random' as const, scoring: { type: 'scratch', noTap: false } } }),
    ]
    const errors = validateBracketSeedingAdvancement(stages)
    expect(errors.length).toBe(1)
  })

  it('accepts bracket_seeding after total_pins', () => {
    const stages = [
      makeStage({ order: 0, advancement: { type: 'bracket_seeding', seedCount: 8, seedBy: 'qualifying_order' } }),
      makeFinalStage({ order: 1 }),
    ]
    const errors = validateBracketSeedingAdvancement(stages)
    expect(errors.length).toBe(0)
  })
})

describe('validateTournament', () => {
  it('returns no errors for valid tournament', () => {
    const input = makeTournament({
      stages: [
        makeStage({ name: 'Qualifying', order: 0, advancement: { type: 'all_advance', carryScores: true } }),
        makeFinalStage({ name: 'Finals', order: 1 }),
      ],
    })
    expect(validateTournament(input)).toEqual([])
  })

  it('reports multiple errors at once', () => {
    const input = makeTournament({
      startDate: '2026-08-05T00:00:00Z',
      endDate: '2026-08-01T00:00:00Z',
      stages: [
        makeStage({ name: 'A', order: 0 }),
        makeStage({ name: 'A', order: 3 }),
      ],
    })
    const errors = validateTournament(input)
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })
})
