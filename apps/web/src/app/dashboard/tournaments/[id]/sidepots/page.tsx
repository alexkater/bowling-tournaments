'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { trpc } from '@/lib/trpc-provider'
import {
  DollarSign,
  Plus,
  X,
  Loader2,
  Calculator,
  Users,
  Medal,
} from 'lucide-react'
import type { SidepotType } from '@bowling/shared'

// ─── Constants ───────────────────────────────────────────────────

const SIDEPOT_TYPE_LABELS: Record<SidepotType, string> = {
  high_game: 'High Game',
  high_series: 'High Series',
  eliminator: 'Eliminator',
  mystery_doubles: 'Mystery Doubles',
  sweeper_doubles: 'Sweeper Doubles',
  big_dog: 'Big Dog',
  blind_draw: 'Blind Draw',
}

const SIDEPOT_TYPE_DESCRIPTIONS: Record<SidepotType, string> = {
  high_game: 'Best single game score wins',
  high_series: 'Best combined series score wins',
  eliminator: 'Lowest scores eliminated each round',
  mystery_doubles: 'Random pairs each game, best combined score wins',
  sweeper_doubles: 'Random pairs each game, best combined score wins',
  big_dog: 'Highest score across all games wins',
  blind_draw: 'Random pairs, combined total wins',
}

// ─── Types ───────────────────────────────────────────────────────

interface SidepotRow {
  id: string
  tournamentId: string
  name: string
  type: string
  entryFee: number
  config: Record<string, unknown>
  status: string
  entryCount: number
  createdAt: Date
  updatedAt: Date
}

interface HighGameResult {
  sidepotId: string
  sidepotType: string
  sidepotName: string
  config: Record<string, unknown>
  entryCount: number
  entryFee: number
  gameNumber: number
  winners: Array<{ playerId: string; score: number; prize: number }>
  prizePool: number
}

interface HighSeriesResult {
  sidepotId: string
  sidepotType: string
  sidepotName: string
  config: Record<string, unknown>
  entryCount: number
  entryFee: number
  gamesIncluded: number[]
  winners: Array<{ playerId: string; score: number; prize: number }>
  prizePool: number
}

interface BigDogResult {
  sidepotId: string
  sidepotType: string
  sidepotName: string
  config: Record<string, unknown>
  entryCount: number
  entryFee: number
  winners: Array<{ playerId: string; score: number; prize: number }>
  prizePool: number
}

interface EliminatorRound {
  gameNumber: number
  advancing: string[]
  eliminated: string[]
}

interface EliminatorResult {
  sidepotId: string
  sidepotType: string
  sidepotName: string
  config: Record<string, unknown>
  entryCount: number
  entryFee: number
  rounds: EliminatorRound[]
  winners: Array<{ playerId: string; score: number; prize: number }>
  prizePool: number
}

interface BlindDrawPair {
  pair: [string, string]
  totalScore: number
}

interface BlindDrawResult {
  sidepotId: string
  sidepotType: string
  sidepotName: string
  config: Record<string, unknown>
  entryCount: number
  entryFee: number
  pairs: BlindDrawPair[]
  winners: Array<{ pair: [string, string]; totalScore: number; prize: number }>
  prizePool: number
}

interface MysteryDoublesRound {
  gameNumber: number
  pairs: BlindDrawPair[]
}

interface MysteryDoublesResult {
  sidepotId: string
  sidepotType: string
  sidepotName: string
  config: Record<string, unknown>
  entryCount: number
  entryFee: number
  rounds: MysteryDoublesRound[]
  prizePool: number
  payout: number
}

type SidepotResult =
  | HighGameResult
  | HighSeriesResult
  | BigDogResult
  | EliminatorResult
  | BlindDrawResult
  | MysteryDoublesResult

// ─── Create Sidepot Modal ────────────────────────────────────────

function CreateSidepotModal({
  tournamentId,
  onClose,
  onCreated,
}: {
  tournamentId: string
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<SidepotType>('high_game')
  const [entryFee, setEntryFee] = useState(0)
  const [handicap, setHandicap] = useState(false)
  const [maxEntries, setMaxEntries] = useState('')
  const [payoutRatio, setPayoutRatio] = useState(0.8)
  const [gamesIncluded, setGamesIncluded] = useState('1,2,3')

  const createMutation = trpc.sidepot.create.useMutation({
    onSuccess: () => {
      onCreated()
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const games = gamesIncluded
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)

    createMutation.mutate({
      tournamentId,
      name: name.trim(),
      type,
      entryFee,
      config: {
        handicap,
        maxEntries: maxEntries ? parseInt(maxEntries, 10) : null,
        payoutRatio,
        gamesIncluded: games.length > 0 ? games : [1, 2, 3],
        gender: 'all',
      },
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Create Sidepot</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Sidepot Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. High Game Pot"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SidepotType)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(Object.entries(SIDEPOT_TYPE_LABELS) as [SidepotType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              {SIDEPOT_TYPE_DESCRIPTIONS[type]}
            </p>
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
              <label className="block text-sm font-medium text-gray-700">Max Entries</label>
              <input
                type="number"
                min={0}
                value={maxEntries}
                onChange={(e) => setMaxEntries(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Unlimited"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700">Games Included</label>
              <input
                type="text"
                value={gamesIncluded}
                onChange={(e) => setGamesIncluded(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="1,2,3"
              />
              <p className="mt-1 text-xs text-gray-400">Comma-separated game numbers</p>
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
              Create Sidepot
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Results Display ─────────────────────────────────────────────

function SidepotResults({ result }: { result: SidepotResult | undefined }) {
  if (!result) return null
  const type = result.sidepotType

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Results</h4>
        <div className="text-sm text-gray-500">
          Prize Pool: <span className="font-medium text-gray-900">${result.prizePool}</span>
        </div>
      </div>

      {/* High Game */}
      {type === 'high_game' && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Game {(result as HighGameResult).gameNumber}
          </p>
          <WinnersList winners={(result as HighGameResult).winners} />
        </div>
      )}

      {/* High Series */}
      {type === 'high_series' && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Games {(result as HighSeriesResult).gamesIncluded.join(', ')}
          </p>
          <WinnersList winners={(result as HighSeriesResult).winners} />
        </div>
      )}

      {/* Big Dog */}
      {type === 'big_dog' && (
        <WinnersList winners={(result as BigDogResult).winners} />
      )}

      {/* Eliminator */}
      {type === 'eliminator' && (
        <div>
          {(result as EliminatorResult).rounds.map((round, idx) => (
            <div key={idx} className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700 mb-1">
                Game {round.gameNumber}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600">
                  Advancing: {round.advancing.length}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-red-600">
                  Eliminated: {round.eliminated.length}
                </span>
              </div>
            </div>
          ))}
          <div className="mt-2">
            <p className="text-xs font-medium text-gray-700 mb-1">Winners</p>
            <WinnersList winners={(result as EliminatorResult).winners} />
          </div>
        </div>
      )}

      {/* Blind Draw */}
      {type === 'blind_draw' && (
        <div>
          <p className="text-xs text-gray-500 mb-2">All Pairs (sorted)</p>
          <div className="space-y-1">
            {(result as BlindDrawResult).pairs.slice(0, 10).map((pair, idx) => (
              <div key={idx} className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-sm">
                <span className="text-gray-700">
                  {pair.pair[0]} & {pair.pair[1]}
                </span>
                <span className="font-mono text-gray-500">{pair.totalScore}</span>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <p className="text-xs font-medium text-gray-700 mb-1">Winners</p>
            {(result as BlindDrawResult).winners.map((w, idx) => (
              <div key={idx} className="flex items-center justify-between rounded bg-green-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-green-800">
                  {w.pair[0]} & {w.pair[1]}
                </span>
                <span className="font-mono text-green-700">${w.prize}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mystery / Sweeper Doubles */}
      {(type === 'mystery_doubles' || type === 'sweeper_doubles') && (
        <div>
          {(result as MysteryDoublesResult).rounds.map((round, idx) => (
            <div key={idx} className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-1">
                Game {round.gameNumber}
              </p>
              <div className="space-y-1">
                {round.pairs.slice(0, 5).map((pair, pIdx) => (
                  <div key={pIdx} className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-sm">
                    <span className="text-gray-700">
                      {pair.pair[0]} & {pair.pair[1]}
                    </span>
                    <span className="font-mono text-gray-500">{pair.totalScore}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="text-sm text-gray-500">
            Payout per round: <span className="font-medium text-gray-900">${(result as MysteryDoublesResult).payout}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function WinnersList({ winners }: { winners: Array<{ playerId: string; score: number; prize: number }> }) {
  return (
    <div className="space-y-1">
      {winners.map((w, idx) => (
        <div
          key={idx}
          className={`flex items-center justify-between rounded px-3 py-1.5 text-sm ${
            idx === 0 ? 'bg-yellow-50 font-medium' : 'bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-2">
            {idx === 0 && <Medal className="h-3.5 w-3.5 text-yellow-500" />}
            <span className={idx === 0 ? 'text-yellow-800' : 'text-gray-700'}>
              {w.playerId}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-gray-500">{w.score}</span>
            {w.prize > 0 && (
              <span className="font-medium text-green-700">${w.prize}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────

export default function SidepotsPage() {
  const params = useParams()
  const tournamentId = params.id as string
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [calculatingId, setCalculatingId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, SidepotResult>>({})

  const { data, isLoading, error } = trpc.sidepot.list.useQuery({ tournamentId })
  const utils = trpc.useUtils()

  const sidepots = (data?.items ?? []) as SidepotRow[]

  const handleCalculate = async (sidepotId: string) => {
    setCalculatingId(sidepotId)
    try {
      const result = await utils.client.sidepot.calculateResults.query(sidepotId)
      setResults((prev) => ({ ...prev, [sidepotId]: result as unknown as SidepotResult }))
    } finally {
      setCalculatingId(null)
    }
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
        <p className="text-sm text-red-600">Failed to load sidepots.</p>
        <p className="mt-1 text-xs text-red-400">{error.message}</p>
      </div>
    )
  }

  return (
    <div>
      {/* Create modal */}
      {showCreateModal && (
        <CreateSidepotModal
          tournamentId={tournamentId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => utils.sidepot.list.invalidate({ tournamentId })}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sidepots</h2>
          <p className="text-sm text-gray-500">Manage side bets and optional competitions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Sidepot
        </button>
      </div>

      {/* Empty state */}
      {sidepots.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No sidepots yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create sidepots for players to compete in optional side competitions.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Sidepot
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sidepots.map((sidepot) => (
            <div
              key={sidepot.id}
              className="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 truncate">{sidepot.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {SIDEPOT_TYPE_LABELS[sidepot.type as SidepotType] ?? sidepot.type}
                  </p>
                </div>
                <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                  sidepot.status === 'open'
                    ? 'bg-green-100 text-green-700 ring-green-300'
                    : sidepot.status === 'paid'
                      ? 'bg-indigo-100 text-indigo-700 ring-indigo-300'
                      : 'bg-gray-100 text-gray-700 ring-gray-300'
                }`}>
                  {sidepot.status}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {sidepot.entryCount} entries
                </span>
                {sidepot.entryFee > 0 && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    ${sidepot.entryFee}
                  </span>
                )}
              </div>

              <div className="mt-4">
                <button
                  onClick={() => handleCalculate(sidepot.id)}
                  disabled={calculatingId === sidepot.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {calculatingId === sidepot.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Calculator className="h-3 w-3" />
                  )}
                  Calculate Results
                </button>
              </div>

              {/* Results */}
              {results[sidepot.id] && (
                <SidepotResults result={results[sidepot.id]} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
