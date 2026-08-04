'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc-provider'
import { Plus, Trash2, ChevronLeft, ChevronRight, Check, Trophy } from 'lucide-react'
import type {
  TournamentCategory,
  StageFormatType,
  AdvancementType,
  StageFormatConfig,
  AdvancementConfig,
  ScoringConfig,
  EventType,
} from '@bowling/shared'

// ─── Types ───────────────────────────────────────────────────────

interface StageForm {
  name: string
  formatType: StageFormatType
  advancementType: AdvancementType
  // Format-specific fields
  gamesPerPlayer: number
  eventType: EventType
  rounds: number
  pointsForWin: number
  pointsForTie: number
  pointsForLoss: number
  bracketType: 'single_elimination' | 'double_elimination' | 'eliminator_bracket'
  bracketSize: number
  seeding: 'random' | 'by_qualifying' | 'by_average'
  positions: 4 | 5
  matchLength: number
  gamesPerMatch: number
  playersPerTeam: number
  gamesPerAttempt: number
  maxAttempts: number
  // Advancement fields
  advanceCount: number
  tiebreaker: 'highest_game' | 'highest_series' | 'roll_off' | 'shared'
  carryScores: boolean
  seedCount: number
  seedBy: 'qualifying_order' | 'average'
  // Scoring
  scoringType: 'scratch' | 'handicap'
  handicapBase: number
  handicapPercentage: number | ''
  noTap: boolean
  // Standings
  standingsScope: 'per_squad' | 'combined'
}

interface TournamentFormData {
  name: string
  description: string
  category: TournamentCategory
  maxPlayers: string
  allowWaitlist: boolean
  startDate: string
  endDate: string
  registrationDeadline: string
  stages: StageForm[]
}

const defaultStage = (order: number, isLast: boolean): StageForm => ({
  name: isLast ? 'Finals' : `Stage ${order + 1}`,
  formatType: 'total_pins',
  advancementType: isLast ? 'final' : 'cut_line',
  gamesPerPlayer: 3,
  eventType: 'singles',
  rounds: 8,
  pointsForWin: 1,
  pointsForTie: 0.5,
  pointsForLoss: 0,
  bracketType: 'single_elimination',
  bracketSize: 16,
  seeding: 'random',
  positions: 4,
  matchLength: 1,
  gamesPerMatch: 2,
  playersPerTeam: 5,
  gamesPerAttempt: 3,
  maxAttempts: 3,
  advanceCount: 16,
  tiebreaker: 'highest_game',
  carryScores: true,
  seedCount: 16,
  seedBy: 'qualifying_order',
  scoringType: 'handicap',
  handicapBase: 220,
  handicapPercentage: '',
  noTap: false,
  standingsScope: 'per_squad',
})

const FORMAT_LABELS: Record<StageFormatType, string> = {
  total_pins: 'Total Pins',
  match_play: 'Match Play',
  bracket: 'Bracket',
  stepladder: 'Stepladder',
  baker: 'Baker',
  round_robin: 'Round Robin',
  best_score: 'Best Score',
}

const ADVANCEMENT_LABELS: Record<AdvancementType, string> = {
  cut_line: 'Cut Line',
  all_advance: 'All Advance',
  bracket_seeding: 'Bracket Seeding',
  final: 'Final Stage',
}

const CATEGORY_LABELS: Record<TournamentCategory, string> = {
  open: 'Open',
  women: 'Women',
  senior: 'Senior',
  youth: 'Youth',
  mixed: 'Mixed',
}

// ─── Helpers ─────────────────────────────────────────────────────

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function buildStageFormat(s: StageForm): StageFormatConfig {
  const scoring: ScoringConfig = {
    type: s.scoringType,
    handicapBase: s.handicapBase,
    handicapPercentage: s.handicapPercentage === '' ? 80 : s.handicapPercentage,
    handicapMax: null,
    noTap: s.noTap,
  }

  switch (s.formatType) {
    case 'total_pins':
      return { type: 'total_pins', gamesPerPlayer: s.gamesPerPlayer, eventType: s.eventType, scoring }
    case 'match_play':
      return { type: 'match_play', rounds: s.rounds, pointsForWin: s.pointsForWin, pointsForTie: s.pointsForTie, pointsForLoss: s.pointsForLoss, scoring }
    case 'bracket':
      return { type: 'bracket', bracketType: s.bracketType, bracketSize: s.bracketSize, seeding: s.seeding, scoring }
    case 'stepladder':
      return { type: 'stepladder', positions: s.positions, matchLength: s.matchLength, scoring }
    case 'baker':
      return { type: 'baker', gamesPerMatch: s.gamesPerMatch, playersPerTeam: s.playersPerTeam, scoring }
    case 'round_robin':
      return { type: 'round_robin', gamesPerMatch: s.gamesPerMatch, pointsForWin: s.pointsForWin, pointsForTie: s.pointsForTie, scoring }
    case 'best_score':
      return { type: 'best_score', gamesPerAttempt: s.gamesPerAttempt, maxAttempts: s.maxAttempts, scoring }
  }
}

function buildAdvancement(s: StageForm): AdvancementConfig {
  switch (s.advancementType) {
    case 'cut_line':
      return { type: 'cut_line', advanceCount: s.advanceCount, tiebreaker: s.tiebreaker }
    case 'all_advance':
      return { type: 'all_advance', carryScores: s.carryScores }
    case 'bracket_seeding':
      return { type: 'bracket_seeding', seedCount: s.seedCount, seedBy: s.seedBy }
    case 'final':
      return { type: 'final' }
  }
}

// ─── Component ───────────────────────────────────────────────────

export default function CreateTournamentPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const createMutation = trpc.tournament.create.useMutation({
    onSuccess: (data) => {
      utils.tournament.organizerList.invalidate()
      router.push(`/dashboard/tournaments/${data.id}`)
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const [form, setForm] = useState<TournamentFormData>({
    name: '',
    description: '',
    category: 'open',
    maxPlayers: '',
    allowWaitlist: true,
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    stages: [defaultStage(0, true)],
  })

  const updateForm = useCallback(<K extends keyof TournamentFormData>(
    key: K,
    value: TournamentFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateStage = useCallback((index: number, updates: Partial<StageForm>) => {
    setForm((prev) => ({
      ...prev,
      stages: prev.stages.map((s, i) => (i === index ? { ...s, ...updates } : s)),
    }))
  }, [])

  const addStage = useCallback(() => {
    setForm((prev) => {
      const newIndex = prev.stages.length
      // Mark previous last stage as non-final
      const updated = prev.stages.map((s, i) =>
        i === prev.stages.length - 1 && s.advancementType === 'final'
          ? { ...s, advancementType: 'cut_line' as const }
          : s,
      )
      return {
        ...prev,
        stages: [...updated, defaultStage(newIndex, true)],
      }
    })
  }, [])

  const removeStage = useCallback((index: number) => {
    setForm((prev) => {
      if (prev.stages.length <= 1) return prev
      const updated = prev.stages.filter((_, i) => i !== index)
      // Ensure last stage is final
      const last = updated[updated.length - 1]
      if (last && last.advancementType !== 'final') {
        updated[updated.length - 1] = { ...last, advancementType: 'final' }
      }
      return { ...prev, stages: updated }
    })
  }, [])

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.name.trim()) return 'Tournament name is required'
      if (!form.startDate) return 'Start date is required'
      if (!form.endDate) return 'End date is required'
      if (form.startDate >= form.endDate) return 'End date must be after start date'
      return null
    }
    if (step === 1) {
      for (let i = 0; i < form.stages.length; i++) {
        const s = form.stages[i]
        if (!s?.name.trim()) return `Stage ${i + 1} name is required`
        if (s?.advancementType === 'cut_line' && (s.advanceCount ?? 0) < 1) return `Stage ${i + 1}: advance count must be at least 1`
      }
      return null
    }
    return null
  }

  const handleNext = () => {
    const err = validateStep()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep((s) => Math.min(s + 1, 2))
  }

  const handleBack = () => {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  const handleSubmit = () => {
    setError(null)

    const stages = form.stages.map((s, i) => ({
      name: s.name,
      order: i,
      format: buildStageFormat(s),
      advancement: buildAdvancement(s),
      squadConfig: null,
      standingsScope: s.standingsScope,
    }))

    createMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
      centerId: '00000000-0000-0000-0000-000000000000', // placeholder — Wave 7 will add center selection
      category: form.category,
      maxPlayers: form.maxPlayers ? parseInt(form.maxPlayers, 10) : null,
      allowWaitlist: form.allowWaitlist,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      registrationDeadline: form.registrationDeadline
        ? new Date(form.registrationDeadline).toISOString()
        : null,
      stages,
    })
  }

  const now = toLocalDatetimeString(new Date())

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Create Tournament</h1>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-0">
          {['Basic Info', 'Stages', 'Review'].map((label, i) => (
            <div key={label} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${i <= step ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i < step
                    ? 'bg-blue-600 text-white'
                    : i === step
                      ? 'border-2 border-blue-600 text-blue-600'
                      : 'border-2 border-gray-300 text-gray-400'
                }`}>
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{label}</span>
              </div>
              {i < 2 && (
                <div className={`flex-1 h-px mx-4 ${i < step ? 'bg-blue-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Step 0: Basic Info */}
      {step === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Tournament Name *
            </label>
            <input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Summer Classic 2025"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Optional description of the tournament"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="category"
                value={form.category}
                onChange={(e) => updateForm('category', e.target.value as TournamentCategory)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {(Object.entries(CATEGORY_LABELS) as [TournamentCategory, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700">
                Max Players
              </label>
              <input
                id="maxPlayers"
                type="number"
                min={1}
                value={form.maxPlayers}
                onChange={(e) => updateForm('maxPlayers', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Leave empty for unlimited"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="allowWaitlist"
              type="checkbox"
              checked={form.allowWaitlist}
              onChange={(e) => updateForm('allowWaitlist', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="allowWaitlist" className="text-sm text-gray-700">
              Allow waitlist when full
            </label>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                Start Date *
              </label>
              <input
                id="startDate"
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => updateForm('startDate', e.target.value)}
                min={now}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                End Date *
              </label>
              <input
                id="endDate"
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => updateForm('endDate', e.target.value)}
                min={form.startDate || now}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700">
                Registration Deadline
              </label>
              <input
                id="registrationDeadline"
                type="datetime-local"
                value={form.registrationDeadline}
                onChange={(e) => updateForm('registrationDeadline', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Stages */}
      {step === 1 && (
        <div className="space-y-4">
          {form.stages.map((stage, index) => (
            <div key={index} className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900">
                  Stage {index + 1}
                  {index === form.stages.length - 1 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Final
                    </span>
                  )}
                </h3>
                {form.stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStage(index)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stage Name</label>
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => updateStage(index, { name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Format</label>
                  <select
                    value={stage.formatType}
                    onChange={(e) => updateStage(index, { formatType: e.target.value as StageFormatType })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {(Object.entries(FORMAT_LABELS) as [StageFormatType, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Format-specific fields */}
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {stage.formatType === 'total_pins' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Games Per Player</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={stage.gamesPerPlayer}
                        onChange={(e) => updateStage(index, { gamesPerPlayer: parseInt(e.target.value, 10) || 1 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Event Type</label>
                      <select
                        value={stage.eventType}
                        onChange={(e) => updateStage(index, { eventType: e.target.value as EventType })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="singles">Singles</option>
                        <option value="doubles">Doubles</option>
                        <option value="trios">Trios</option>
                        <option value="teams">Teams</option>
                        <option value="all_events">All Events</option>
                      </select>
                    </div>
                  </>
                )}

                {stage.formatType === 'match_play' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Rounds</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={stage.rounds}
                        onChange={(e) => updateStage(index, { rounds: parseInt(e.target.value, 10) || 1 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Points For Win</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={stage.pointsForWin}
                        onChange={(e) => updateStage(index, { pointsForWin: parseFloat(e.target.value) || 0 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {stage.formatType === 'bracket' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bracket Type</label>
                      <select
                        value={stage.bracketType}
                        onChange={(e) => updateStage(index, { bracketType: e.target.value as 'single_elimination' | 'double_elimination' | 'eliminator_bracket' })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="single_elimination">Single Elimination</option>
                        <option value="double_elimination">Double Elimination</option>
                        <option value="eliminator_bracket">Eliminator</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Bracket Size</label>
                      <select
                        value={stage.bracketSize}
                        onChange={(e) => updateStage(index, { bracketSize: parseInt(e.target.value, 10) })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        {[4, 8, 16, 32, 64].map((n) => (
                          <option key={n} value={n}>{n} players</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Seeding</label>
                      <select
                        value={stage.seeding}
                        onChange={(e) => updateStage(index, { seeding: e.target.value as 'random' | 'by_qualifying' | 'by_average' })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="random">Random</option>
                        <option value="by_qualifying">By Qualifying</option>
                        <option value="by_average">By Average</option>
                      </select>
                    </div>
                  </>
                )}

                {stage.formatType === 'stepladder' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Positions</label>
                      <select
                        value={stage.positions}
                        onChange={(e) => updateStage(index, { positions: parseInt(e.target.value, 10) as 4 | 5 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={4}>Top 4</option>
                        <option value={5}>Top 5</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Games Per Match</label>
                      <input
                        type="number"
                        min={1}
                        max={3}
                        value={stage.matchLength}
                        onChange={(e) => updateStage(index, { matchLength: parseInt(e.target.value, 10) || 1 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {stage.formatType === 'baker' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Games Per Match</label>
                      <input
                        type="number"
                        min={1}
                        max={7}
                        value={stage.gamesPerMatch}
                        onChange={(e) => updateStage(index, { gamesPerMatch: parseInt(e.target.value, 10) || 1 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Players Per Team</label>
                      <input
                        type="number"
                        min={1}
                        value={stage.playersPerTeam}
                        onChange={(e) => updateStage(index, { playersPerTeam: parseInt(e.target.value, 10) || 1 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {stage.formatType === 'round_robin' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Games Per Match</label>
                      <input
                        type="number"
                        min={1}
                        value={stage.gamesPerMatch}
                        onChange={(e) => updateStage(index, { gamesPerMatch: parseInt(e.target.value, 10) || 1 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Points For Win</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={stage.pointsForWin}
                        onChange={(e) => updateStage(index, { pointsForWin: parseFloat(e.target.value) || 0 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {stage.formatType === 'best_score' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Games Per Attempt</label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={stage.gamesPerAttempt}
                        onChange={(e) => updateStage(index, { gamesPerAttempt: parseInt(e.target.value, 10) || 1 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Max Attempts</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={stage.maxAttempts}
                        onChange={(e) => updateStage(index, { maxAttempts: parseInt(e.target.value, 10) || 1 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {/* Scoring config (shown for all formats) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Scoring</label>
                  <select
                    value={stage.scoringType}
                    onChange={(e) => updateStage(index, { scoringType: e.target.value as 'scratch' | 'handicap' })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="scratch">Scratch</option>
                    <option value="handicap">Handicap</option>
                  </select>
                </div>

                {stage.scoringType === 'handicap' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Handicap Base</label>
                      <input
                        type="number"
                        min={150}
                        max={300}
                        value={stage.handicapBase}
                        onChange={(e) => updateStage(index, { handicapBase: parseInt(e.target.value, 10) || 220 })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Handicap %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={stage.handicapPercentage}
                        onChange={(e) => updateStage(index, { handicapPercentage: e.target.value === '' ? '' : Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 mt-6">
                  <input
                    id={`noTap-${index}`}
                    type="checkbox"
                    checked={stage.noTap}
                    onChange={(e) => updateStage(index, { noTap: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={`noTap-${index}`} className="text-sm text-gray-700">No-Tap</label>
                </div>

                {/* Standings scope */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">How are standings calculated?</h4>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name={`standingsScope-${index}`}
                        checked={stage.standingsScope === 'per_squad'}
                        onChange={() => updateStage(index, { standingsScope: 'per_squad' })}
                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Per Squad (separate rankings)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name={`standingsScope-${index}`}
                        checked={stage.standingsScope === 'combined'}
                        onChange={() => updateStage(index, { standingsScope: 'combined' })}
                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Combined (all squads together)
                    </label>
                  </div>
                </div>
              </div>

              {/* Advancement config */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Advancement</h4>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <select
                      value={stage.advancementType}
                      onChange={(e) => updateStage(index, { advancementType: e.target.value as AdvancementType })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {(Object.entries(ADVANCEMENT_LABELS) as [AdvancementType, string][]).map(([value, label]) => (
                        <option key={value} value={value} disabled={value === 'final' && index < form.stages.length - 1}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {stage.advancementType === 'cut_line' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Advance Count</label>
                        <input
                          type="number"
                          min={1}
                          value={stage.advanceCount}
                          onChange={(e) => updateStage(index, { advanceCount: parseInt(e.target.value, 10) || 1 })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Tiebreaker</label>
                        <select
                          value={stage.tiebreaker}
                          onChange={(e) => updateStage(index, { tiebreaker: e.target.value as 'highest_game' | 'highest_series' | 'roll_off' | 'shared' })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="highest_game">Highest Game</option>
                          <option value="highest_series">Highest Series</option>
                          <option value="roll_off">Roll Off</option>
                          <option value="shared">Shared</option>
                        </select>
                      </div>
                    </>
                  )}

                  {stage.advancementType === 'all_advance' && (
                    <div className="flex items-center gap-2 mt-6">
                      <input
                        id={`carryScores-${index}`}
                        type="checkbox"
                        checked={stage.carryScores}
                        onChange={(e) => updateStage(index, { carryScores: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor={`carryScores-${index}`} className="text-sm text-gray-700">Carry Scores</label>
                    </div>
                  )}

                  {stage.advancementType === 'bracket_seeding' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Seed Count</label>
                        <input
                          type="number"
                          min={2}
                          value={stage.seedCount}
                          onChange={(e) => updateStage(index, { seedCount: parseInt(e.target.value, 10) || 2 })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Seed By</label>
                        <select
                          value={stage.seedBy}
                          onChange={(e) => updateStage(index, { seedBy: e.target.value as 'qualifying_order' | 'average' })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="qualifying_order">Qualifying Order</option>
                          <option value="average">Average</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addStage}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Stage
          </button>
        </div>
      )}

      {/* Step 2: Review */}
      {step === 2 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Review Tournament</h3>
            <p className="mt-1 text-sm text-gray-500">Please review all information before creating the tournament.</p>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Basic Information</h4>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Name</dt>
                <dd className="text-sm font-medium text-gray-900">{form.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Category</dt>
                <dd className="text-sm font-medium text-gray-900">{CATEGORY_LABELS[form.category]}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Start Date</dt>
                <dd className="text-sm font-medium text-gray-900">{new Date(form.startDate).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">End Date</dt>
                <dd className="text-sm font-medium text-gray-900">{new Date(form.endDate).toLocaleString()}</dd>
              </div>
              {form.description && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-gray-500">Description</dt>
                  <dd className="text-sm text-gray-900">{form.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-500">Max Players</dt>
                <dd className="text-sm font-medium text-gray-900">{form.maxPlayers || 'Unlimited'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Waitlist</dt>
                <dd className="text-sm font-medium text-gray-900">{form.allowWaitlist ? 'Enabled' : 'Disabled'}</dd>
              </div>
              {form.registrationDeadline && (
                <div>
                  <dt className="text-xs text-gray-500">Registration Deadline</dt>
                  <dd className="text-sm font-medium text-gray-900">{new Date(form.registrationDeadline).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Stages ({form.stages.length})</h4>
            {form.stages.map((stage, index) => (
              <div key={index} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-gray-900">
                    Stage {index + 1}: {stage.name}
                  </h5>
                  {index === form.stages.length - 1 && (
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Final
                    </span>
                  )}
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="text-gray-500">Format:</span>{' '}
                    <span className="font-medium text-gray-900">{FORMAT_LABELS[stage.formatType]}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Advancement:</span>{' '}
                    <span className="font-medium text-gray-900">{ADVANCEMENT_LABELS[stage.advancementType]}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Scoring:</span>{' '}
                    <span className="font-medium text-gray-900 capitalize">{stage.scoringType}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-8 flex items-center justify-between">
        <div>
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
        </div>
        {step < 2 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {createMutation.isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Create Tournament
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
