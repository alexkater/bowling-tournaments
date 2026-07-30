import type {
  StageFormatConfig,
  AdvancementConfig,
} from '../types/stage'

export interface TournamentInput {
  name: string
  startDate: string
  endDate: string
  registrationDeadline: string | null
  stages: StageInput[]
}

export interface StageInput {
  name: string
  order: number
  format: StageFormatConfig
  advancement: AdvancementConfig
}

export interface ValidationError {
  path: string
  message: string
}

export function validateStageNames(stages: StageInput[]): ValidationError[] {
  const names = new Set<string>()
  const errors: ValidationError[] = []

  for (let i = 0; i < stages.length; i++) {
    const name = stages[i]!.name
    if (names.has(name)) {
      errors.push({
        path: `stages[${i}].name`,
        message: `Duplicate stage name "${name}". Stage names must be unique.`,
      })
    }
    names.add(name)
  }

  return errors
}

export function validateStageOrder(stages: StageInput[]): ValidationError[] {
  const errors: ValidationError[] = []

  for (let i = 0; i < stages.length; i++) {
    if (stages[i]!.order !== i) {
      errors.push({
        path: `stages[${i}].order`,
        message: `Stage order must be sequential. Expected ${i}, got ${stages[i]!.order}.`,
      })
    }
  }

  return errors
}

export function validateLastStageIsFinal(stages: StageInput[]): ValidationError[] {
  if (stages.length === 0) return []

  const lastStage = stages[stages.length - 1]!
  if (lastStage.advancement.type !== 'final') {
    return [{
      path: `stages[${stages.length - 1}].advancement.type`,
      message: 'The last stage must have advancement type "final".',
    }]
  }

  return []
}

export function validateOnlyLastStageIsFinal(stages: StageInput[]): ValidationError[] {
  const errors: ValidationError[] = []

  for (let i = 0; i < stages.length - 1; i++) {
    if (stages[i]!.advancement.type === 'final') {
      errors.push({
        path: `stages[${i}].advancement.type`,
        message: 'Only the last stage can have advancement type "final".',
      })
    }
  }

  return errors
}

export function validateDates(input: TournamentInput): ValidationError[] {
  const errors: ValidationError[] = []
  const start = new Date(input.startDate)
  const end = new Date(input.endDate)

  if (isNaN(start.getTime())) {
    errors.push({ path: 'startDate', message: 'Invalid startDate.' })
  }
  if (isNaN(end.getTime())) {
    errors.push({ path: 'endDate', message: 'Invalid endDate.' })
  }
  if (errors.length > 0) return errors

  if (start >= end) {
    errors.push({
      path: 'endDate',
      message: 'startDate must be before endDate.',
    })
  }

  if (input.registrationDeadline) {
    const deadline = new Date(input.registrationDeadline)
    if (isNaN(deadline.getTime())) {
      errors.push({ path: 'registrationDeadline', message: 'Invalid registrationDeadline.' })
    } else if (deadline >= start) {
      errors.push({
        path: 'registrationDeadline',
        message: 'registrationDeadline must be before startDate.',
      })
    }
  }

  return errors
}

export function validateStepladderOnlyLast(stages: StageInput[]): ValidationError[] {
  const errors: ValidationError[] = []

  for (let i = 0; i < stages.length - 1; i++) {
    if (stages[i]!.format.type === 'stepladder') {
      errors.push({
        path: `stages[${i}].format`,
        message: 'Stepladder format can only be used in the last stage.',
      })
    }
  }

  return errors
}

export function validateBracketSeedingAdvancement(stages: StageInput[]): ValidationError[] {
  const errors: ValidationError[] = []
  const allowedPreceding: StageFormatConfig['type'][] = ['total_pins', 'best_score', 'round_robin']

  for (let i = 1; i < stages.length; i++) {
    const advancement = stages[i]!.advancement
    if (advancement.type === 'bracket_seeding') {
      const prevFormat = stages[i - 1]!.format.type
      if (!allowedPreceding.includes(prevFormat)) {
        errors.push({
          path: `stages[${i}].advancement.type`,
          message: `bracket_seeding advancement must follow total_pins, best_score, or round_robin. Got: ${prevFormat}.`,
        })
      }
    }
  }

  return errors
}

export function validateTournament(input: TournamentInput): ValidationError[] {
  return [
    ...validateDates(input),
    ...validateStageNames(input.stages),
    ...validateStageOrder(input.stages),
    ...validateLastStageIsFinal(input.stages),
    ...validateOnlyLastStageIsFinal(input.stages),
    ...validateStepladderOnlyLast(input.stages),
    ...validateBracketSeedingAdvancement(input.stages),
  ]
}
