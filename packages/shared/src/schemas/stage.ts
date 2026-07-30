import { z } from 'zod'

// ---- Scoring Config ----

export const ScoringConfigSchema = z.object({
  type: z.enum(['scratch', 'handicap']).default('handicap'),
  handicapBase: z.number().min(150).max(300).default(220),
  handicapPercentage: z.number().min(0).max(100).default(80),
  handicapMax: z.number().nullable().default(null),
  noTap: z.boolean().default(false),
})

// ---- Format Configs ----

export const TotalPinsConfigSchema = z.object({
  type: z.literal('total_pins'),
  gamesPerPlayer: z.number().min(1).max(12).default(3),
  eventType: z.enum(['singles', 'doubles', 'trios', 'teams', 'all_events']).default('singles'),
  scoring: ScoringConfigSchema.default({}),
})

export const MatchPlayConfigSchema = z.object({
  type: z.literal('match_play'),
  rounds: z.number().min(1).max(50).default(8),
  pointsForWin: z.number().default(1),
  pointsForTie: z.number().default(0.5),
  pointsForLoss: z.number().default(0),
  scoring: ScoringConfigSchema.default({}),
})

export const BracketConfigSchema = z.object({
  type: z.literal('bracket'),
  bracketType: z.enum(['single_elimination', 'double_elimination', 'eliminator_bracket']).default('single_elimination'),
  bracketSize: z.number().refine((n) => [4, 8, 16, 32, 64].includes(n), {
    message: 'Bracket size must be 4, 8, 16, 32, or 64',
  }).default(16),
  seeding: z.enum(['random', 'by_qualifying', 'by_average']).default('random'),
  scoring: ScoringConfigSchema.default({}),
  eliminatorConfig: z.object({
    rounds: z.number().min(1).max(10).default(3),
    advancePerRound: z.number().min(1).default(4),
    gamesPerRound: z.number().min(1).max(3).default(1),
  }).optional(),
})

export const StepladderConfigSchema = z.object({
  type: z.literal('stepladder'),
  positions: z.union([z.literal(4), z.literal(5)]).default(4),
  matchLength: z.number().min(1).max(3).default(1),
  scoring: ScoringConfigSchema.default({}),
})

export const BakerConfigSchema = z.object({
  type: z.literal('baker'),
  gamesPerMatch: z.number().min(1).max(7).default(2),
  playersPerTeam: z.number().default(5),
  scoring: ScoringConfigSchema.default({}),
})

export const RoundRobinConfigSchema = z.object({
  type: z.literal('round_robin'),
  gamesPerMatch: z.number().default(1),
  pointsForWin: z.number().default(1),
  pointsForTie: z.number().default(0.5),
  scoring: ScoringConfigSchema.default({}),
})

export const BestScoreConfigSchema = z.object({
  type: z.literal('best_score'),
  gamesPerAttempt: z.number().min(1).max(6).default(3),
  maxAttempts: z.number().min(1).max(10).default(3),
  scoring: ScoringConfigSchema.default({}),
})

export const StageFormatConfigSchema = z.discriminatedUnion('type', [
  TotalPinsConfigSchema,
  MatchPlayConfigSchema,
  BracketConfigSchema,
  StepladderConfigSchema,
  BakerConfigSchema,
  RoundRobinConfigSchema,
  BestScoreConfigSchema,
])

// ---- Advancement Configs ----

export const CutLineAdvancementSchema = z.object({
  type: z.literal('cut_line'),
  advanceCount: z.number().min(1),
  tiebreaker: z.enum(['highest_game', 'highest_series', 'roll_off', 'shared']).default('highest_game'),
  label: z.string().optional(),
})

export const AllAdvancementSchema = z.object({
  type: z.literal('all_advance'),
  carryScores: z.boolean().default(true),
})

export const BracketSeedingAdvancementSchema = z.object({
  type: z.literal('bracket_seeding'),
  seedCount: z.number().min(2),
  seedBy: z.enum(['qualifying_order', 'average']).default('qualifying_order'),
})

export const FinalAdvancementSchema = z.object({
  type: z.literal('final'),
})

export const AdvancementConfigSchema = z.discriminatedUnion('type', [
  CutLineAdvancementSchema,
  AllAdvancementSchema,
  BracketSeedingAdvancementSchema,
  FinalAdvancementSchema,
])

// ---- Stage ----

export const SquadConfigSchema = z.object({
  label: z.string().default('Squad'),
  count: z.number().min(1).default(1),
  allowReEntry: z.boolean().default(false),
  standingsScope: z.enum(['per_squad', 'combined']).default('per_squad'),
})

export const StageSchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().min(0),
  format: StageFormatConfigSchema,
  advancement: AdvancementConfigSchema,
  squadConfig: SquadConfigSchema.nullable().default(null),
  standingsScope: z.enum(['per_squad', 'combined']).optional(),
})

// ---- Tournament ----

export const TournamentBaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().default(null),
  centerId: z.string().uuid().nullable().default(null),
  category: z.enum(['open', 'women', 'senior', 'youth', 'mixed']).default('open'),
  maxPlayers: z.number().nullable().default(null),
  allowWaitlist: z.boolean().default(true),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  registrationDeadline: z.string().datetime().nullable().default(null),
  stages: z.array(StageSchema).min(1),
})

export const CreateTournamentSchema = TournamentBaseSchema.refine(
  (data) => {
    const lastStage = data.stages[data.stages.length - 1]
    return lastStage?.advancement.type === 'final'
  },
  { message: 'Last stage must have advancement type "final"' },
).refine(
  (data) => {
    const nonLast = data.stages.slice(0, -1)
    return nonLast.every((s) => s.advancement.type !== 'final')
  },
  { message: 'Only the last stage can have advancement type "final"' },
).refine(
  (data) => {
    return data.stages.every((s, i) => s.order === i)
  },
  { message: 'Stage order must be sequential starting from 0' },
)

export const UpdateTournamentSchema = TournamentBaseSchema.partial()
