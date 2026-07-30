'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { trpc } from '@/lib/trpc-provider'
import {
  Swords,
  Plus,
  Shuffle,
  ChevronRight,
  Trophy,
  X,
  Loader2,
  CheckCircle2,
  DollarSign,
  Users,
} from 'lucide-react'
import type { BracketPoolType, BracketStatus } from '@bowling/shared'

// ─── Constants ───────────────────────────────────────────────────

const POOL_TYPE_LABELS: Record<BracketPoolType, string> = {
  eight_person_forward: '8-Person Forward',
  eight_person_reverse: '8-Person Reverse',
  eight_person_eliminator: '8-Person Eliminator',
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
}

const STATUS_STYLES: Record<BracketStatus, string> = {
  open: 'bg-green-100 text-green-700 ring-green-300',
  shuffling: 'bg-yellow-100 text-yellow-700 ring-yellow-300',
  in_progress: 'bg-blue-100 text-blue-700 ring-blue-300',
  completed: 'bg-indigo-100 text-indigo-700 ring-indigo-300',
  cancelled: 'bg-red-100 text-red-700 ring-red-300',
}

// ─── Types ───────────────────────────────────────────────────────

interface BracketPoolRow {
  id: string
  tournamentId: string
  name: string
  type: string
  entryFee: number
  maxPlayers: number
  currentPlayers: number
  status: string
  config: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

interface BracketMatchRow {
  id: string
  roundId: string
  position: number
  player1Id: string | null
  player2Id: string | null
  player1Score: number | null
  player2Score: number | null
  winnerId: string | null
  nextMatchId: string | null
  nextMatchPosition: 'top' | 'bottom' | null
}

interface BracketRoundRow {
  roundNumber: number
  completed: boolean
  matches: BracketMatchRow[]
}

interface BracketDetail {
  id: string
  tournamentId: string
  name: string
  type: string
  entryFee: number
  maxPlayers: number
  status: string
  config: Record<string, unknown>
  rounds: BracketRoundRow[]
}

// ─── Create Pool Modal ───────────────────────────────────────────

function CreatePoolModal({
  tournamentId,
  onClose,
  onCreated,
}: {
  tournamentId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<BracketPoolType>('eight_person_forward')
  const [entryFee, setEntryFee] = useState(0)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [handicap, setHandicap] = useState(false)
  const [allowMultipleEntries, setAllowMultipleEntries] = useState(true)
  const [maxEntriesPerPlayer, setMaxEntriesPerPlayer] = useState(5)
  const [payoutRatio, setPayoutRatio] = useState(0.8)
  const [bracketSize, setBracketSize] = useState(8)

  const createMutation = trpc.bracket.createPool.useMutation({
    onSuccess: () => {
      onCreated()
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    createMutation.mutate({
      tournamentId,
      name: name.trim(),
      type,
      entryFee,
      maxPlayers,
      config: {
        handicap,
        allowMultipleEntries,
        maxEntriesPerPlayer,
        payoutRatio,
        bracketSize,
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Create Bracket Pool</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Pool Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Side Bracket A"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as BracketPoolType)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(Object.entries(POOL_TYPE_LABELS) as [BracketPoolType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Entry Fee ($)</label>
              <input
                type="number"
                min={0}
                value={entryFee}
                onChange={(e) => setEntryFee(parseInt(e.target.value, 10) || 0)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Players</label>
              <input
                type="number"
                min={2}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10) || 8)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Bracket Size</label>
              <select
                value={bracketSize}
                onChange={(e) => setBracketSize(parseInt(e.target.value, 10))}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[4, 8, 16, 32, 64].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Payout Ratio</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={payoutRatio}
                onChange={(e) => setPayoutRatio(parseFloat(e.target.value) || 0.8)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="handicap"
              type="checkbox"
              checked={handicap}
              onChange={(e) => setHandicap(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="handicap" className="text-sm text-gray-700">Handicap</label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="allowMultiple"
              type="checkbox"
              checked={allowMultipleEntries}
              onChange={(e) => setAllowMultipleEntries(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="allowMultiple" className="text-sm text-gray-700">Allow Multiple Entries</label>
          </div>

          {allowMultipleEntries && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Max Entries Per Player</label>
              <input
                type="number"
                min={1}
                value={maxEntriesPerPlayer}
                onChange={(e) => setMaxEntriesPerPlayer(parseInt(e.target.value, 10) || 1)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Pool
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Score Entry Modal ───────────────────────────────────────────

function ScoreEntryModal({
  match,
  onClose,
  onSaved,
}: {
  match: BracketMatchRow
  onClose: () => void
  onSaved: () => void
}) {
  const [score1, setScore1] = useState(match.player1Score?.toString() ?? '')
  const [score2, setScore2] = useState(match.player2Score?.toString() ?? '')

  const enterScoreMutation = trpc.bracket.enterScore.useMutation({
    onSuccess: () => {
      onSaved()
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const s1 = parseInt(score1, 10)
    const s2 = parseInt(score2, 10)
    if (isNaN(s1) || isNaN(s2)) return
    enterScoreMutation.mutate({
      matchId: match.id,
      player1Score: s1,
      player2Score: s2,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Enter Scores</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Match #{match.position}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Player 1 Score
              </label>
              <input
                type="number"
                min={0}
                value={score1}
                onChange={(e) => setScore1(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Player 2 Score
              </label>
              <input
                type="number"
                min={0}
                value={score2}
                onChange={(e) => setScore2(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enterScoreMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {enterScoreMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Save Scores
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Bracket Tree View ───────────────────────────────────────────

function BracketTreeView({
  pool,
  onBack,
}: {
  pool: BracketDetail
  onBack: () => void
}) {
  const utils = trpc.useUtils()
  const [scoreMatch, setScoreMatch] = useState<BracketMatchRow | null>(null)

  const advanceMutation = trpc.bracket.advanceRound.useMutation({
    onSuccess: () => {
      utils.bracket.getBracket.invalidate(pool.id)
    },
  })

  const handleAdvance = () => {
    advanceMutation.mutate({ poolId: pool.id })
  }

  const currentRound = pool.rounds.find((r) => !r.completed)
  const isCompleted = pool.status === 'completed'
  const champion = isCompleted && pool.rounds.length > 0
    ? pool.rounds[pool.rounds.length - 1]?.matches[0]?.winnerId
    : null

  return (
    <div>
      {/* Score entry modal */}
      {scoreMatch && (
        <ScoreEntryModal
          match={scoreMatch}
          onClose={() => setScoreMatch(null)}
          onSaved={() => utils.bracket.getBracket.invalidate(pool.id)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            &larr; Back to pools
          </button>
          <h2 className="text-xl font-bold text-gray-900 mt-1">{pool.name}</h2>
          <p className="text-sm text-gray-500">
            {POOL_TYPE_LABELS[pool.type as BracketPoolType] ?? pool.type}
            {' · '}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[pool.status as BracketStatus]}`}>
              {pool.status.replace('_', ' ')}
            </span>
          </p>
        </div>

        {!isCompleted && pool.status === 'in_progress' && currentRound && (
          <button
            onClick={handleAdvance}
            disabled={advanceMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {advanceMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Advance Round
          </button>
        )}
      </div>

      {/* Champion banner */}
      {isCompleted && champion && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-center">
          <Trophy className="mx-auto h-8 w-8 text-yellow-500" />
          <p className="mt-2 text-lg font-bold text-yellow-800">Champion crowned!</p>
          <p className="text-sm text-yellow-600">Winner ID: {champion}</p>
        </div>
      )}

      {/* Rounds */}
      <div className="space-y-8">
        {pool.rounds.map((round, roundIdx) => (
          <div key={roundIdx}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Round {round.roundNumber}
              </h3>
              {round.completed && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {!round.completed && round === currentRound && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Active
                </span>
              )}
            </div>

            <div className="grid gap-3">
              {round.matches.map((match) => {
                const isWinner1 = match.winnerId === match.player1Id
                const isWinner2 = match.winnerId === match.player2Id
                const isBye = !match.player1Id || !match.player2Id

                return (
                  <div
                    key={match.id}
                    className={`rounded-lg border bg-white p-3 ${
                      match.winnerId ? 'border-green-200' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 space-y-1.5">
                        {/* Player 1 */}
                        <div className={`flex items-center justify-between rounded px-2 py-1 ${
                          isWinner1 ? 'bg-green-50 font-medium text-green-800' : ''
                        }`}>
                          <span className="text-sm truncate">
                            {match.player1Id ?? '—'}
                          </span>
                          <span className="text-sm font-mono ml-4">
                            {match.player1Score !== null ? match.player1Score : '—'}
                          </span>
                        </div>

                        {/* Separator */}
                        <div className="border-t border-gray-100" />

                        {/* Player 2 */}
                        <div className={`flex items-center justify-between rounded px-2 py-1 ${
                          isWinner2 ? 'bg-green-50 font-medium text-green-800' : ''
                        }`}>
                          <span className="text-sm truncate">
                            {match.player2Id ?? '—'}
                          </span>
                          <span className="text-sm font-mono ml-4">
                            {match.player2Score !== null ? match.player2Score : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="ml-3 flex flex-col gap-1">
                        {!match.winnerId && !isBye && (
                          <button
                            onClick={() => setScoreMatch(match)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Score
                          </button>
                        )}
                        {match.winnerId && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Done
                          </span>
                        )}
                        {isBye && (
                          <span className="text-xs text-gray-400">Bye</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────

export default function BracketsPage() {
  const params = useParams()
  const tournamentId = params.id as string
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [viewingPoolId, setViewingPoolId] = useState<string | null>(null)

  const { data: pools, isLoading, error } = trpc.bracket.list.useQuery({ tournamentId })
  const { data: bracketDetail } = trpc.bracket.getBracket.useQuery(
    viewingPoolId ?? '',
    { enabled: !!viewingPoolId },
  )
  const utils = trpc.useUtils()

  const shuffleMutation = trpc.bracket.shuffle.useMutation({
    onSuccess: () => {
      utils.bracket.list.invalidate({ tournamentId })
    },
  })

  const handleShuffle = (poolId: string) => {
    shuffleMutation.mutate({ poolId })
  }

  // If viewing a specific bracket tree
  if (viewingPoolId && bracketDetail) {
    return (
      <BracketTreeView
        pool={bracketDetail as unknown as BracketDetail}
        onBack={() => {
          setViewingPoolId(null)
          utils.bracket.list.invalidate({ tournamentId })
        }}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-600">Failed to load bracket pools.</p>
        <p className="mt-1 text-xs text-red-400">{error.message}</p>
      </div>
    )
  }

  const poolList = (pools ?? []) as BracketPoolRow[]

  return (
    <div>
      {/* Create modal */}
      {showCreateModal && (
        <CreatePoolModal
          tournamentId={tournamentId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => utils.bracket.list.invalidate({ tournamentId })}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bracket Pools</h2>
          <p className="text-sm text-gray-500">Manage bracket-style side competitions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Pool
        </button>
      </div>

      {/* Empty state */}
      {poolList.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Swords className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No bracket pools yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create a bracket pool for players to compete in head-to-head matchups.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Pool
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {poolList.map((pool) => (
            <div
              key={pool.id}
              className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 truncate">{pool.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {POOL_TYPE_LABELS[pool.type as BracketPoolType] ?? pool.type}
                  </p>
                </div>
                <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[pool.status as BracketStatus]}`}>
                  {pool.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {pool.currentPlayers}/{pool.maxPlayers}
                </span>
                {pool.entryFee > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    ${pool.entryFee}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2">
                {pool.status === 'open' && (
                  <button
                    onClick={() => handleShuffle(pool.id)}
                    disabled={shuffleMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {shuffleMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Shuffle className="h-3 w-3" />
                    )}
                    Shuffle
                  </button>
                )}
                <button
                  onClick={() => setViewingPoolId(pool.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  <Swords className="h-3 w-3" />
                  View Bracket
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
