'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import { ArrowLeft, Medal, AlertCircle, Trophy } from 'lucide-react'
import type { StandingsEntry } from '@bowling/shared'

// ─── Types ──────────────────────────────────────────────────────────

interface CombinedStandings {
  scope: 'combined'
  standings: StandingsEntry[]
}

interface PerSquadGroup {
  squadId: string
  squadName: string
  entries: StandingsEntry[]
}

interface PerSquadStandings {
  scope: 'per_squad'
  standings: PerSquadGroup[]
}

type TournamentStandings = CombinedStandings | PerSquadStandings

// ─── Constants ──────────────────────────────────────────────────────

const RANK_COLORS: Record<number, { bg: string; text: string; icon: string; label: string }> = {
  1: { bg: 'bg-yellow-50', text: 'text-yellow-800', icon: 'text-yellow-500', label: '1st' },
  2: { bg: 'bg-gray-50', text: 'text-gray-800', icon: 'text-gray-400', label: '2nd' },
  3: { bg: 'bg-orange-50', text: 'text-orange-800', icon: 'text-orange-400', label: '3rd' },
}

const RANK_MEDALS: Record<number, React.ReactNode> = {
  1: <Medal className="h-4 w-4 text-yellow-500" />,
  2: <Medal className="h-4 w-4 text-gray-400" />,
  3: <Medal className="h-4 w-4 text-orange-400" />,
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatBehind(behind: number): string {
  if (behind === 0) return '—'
  return `+${behind}`
}

function formatScore(value: number): string {
  return String(value)
}

// ─── Standings Table ────────────────────────────────────────────────

function StandingsTable({ entries }: { entries: StandingsEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <Trophy className="mx-auto h-12 w-12 text-gray-300" />
        <h3 className="mt-4 text-lg font-semibold text-gray-900">No standings yet</h3>
        <p className="mt-2 text-sm text-gray-500">
          Scores need to be entered before standings are available.
        </p>
      </div>
    )
  }

  // Determine max game count across all entries
  const maxGames = entries.reduce(
    (max, e) => Math.max(max, e.games.length),
    0,
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        {/* Header */}
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Player
            </th>
            {Array.from({ length: maxGames }, (_, i) => (
              <th
                key={i}
                className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                G{i + 1}
              </th>
            ))}
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              HCP Total
            </th>
            <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Behind
            </th>
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-gray-100">
          {entries.map((entry) => {
            const rankStyle = RANK_COLORS[entry.rank]
            const isTop3 = entry.rank >= 1 && entry.rank <= 3

            return (
              <tr
                key={entry.playerId}
                className={`transition-colors ${
                  entry.isCut
                    ? 'opacity-50'
                    : isTop3 && rankStyle
                      ? `${rankStyle.bg} hover:${rankStyle.bg}`
                      : 'hover:bg-gray-50'
                }`}
              >
                {/* Rank */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center">
                    {isTop3 && rankStyle ? (
                      RANK_MEDALS[entry.rank]
                    ) : (
                      <span className="text-sm font-medium text-gray-500 tabular-nums">
                        {entry.rank}
                      </span>
                    )}
                  </div>
                </td>

                {/* Player name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isTop3 && rankStyle ? rankStyle.text : 'text-gray-900'
                      }`}
                    >
                      {entry.playerName}
                    </span>
                    {entry.isCut && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        Cut
                      </span>
                    )}
                  </div>
                </td>

                {/* Game scores */}
                {Array.from({ length: maxGames }, (_, i) => {
                  const game = entry.games[i]
                  return (
                    <td
                      key={i}
                      className="px-3 py-3 text-center text-sm tabular-nums text-gray-700"
                    >
                      {game ? formatScore(game.rawScore) : '—'}
                    </td>
                  )
                })}

                {/* Raw total */}
                <td className="px-3 py-3 text-center text-sm font-semibold text-gray-900 tabular-nums">
                  {formatScore(entry.totalRaw)}
                </td>

                {/* Handicap total */}
                <td className="px-3 py-3 text-center text-sm font-semibold text-blue-600 tabular-nums">
                  {formatScore(entry.totalHandicap)}
                </td>

                {/* Behind */}
                <td className="px-3 py-3 text-center text-sm tabular-nums text-gray-500">
                  {formatBehind(entry.behind)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────

export default function StandingsPage() {
  const params = useParams()
  const tournamentId = params.id as string

  const { data, isLoading, error } = trpc.standings.getByTournament.useQuery(tournamentId, {
    refetchInterval: 30_000,
  })

  const standings = data as TournamentStandings | undefined

  // ─── Loading state ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-4 w-48 rounded bg-gray-100" />
        <div className="mt-8 h-96 rounded-lg bg-gray-100" />
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────

  if (error || !standings) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
        <p className="mt-3 text-sm text-red-600">
          {error?.message === 'NOT_FOUND'
            ? 'Tournament not found.'
            : 'Failed to load standings.'}
        </p>
        <Link
          href={`/dashboard/tournaments/${tournamentId}`}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tournament
        </Link>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/dashboard/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Tournament
      </Link>

      {/* Header */}
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Standings</h1>
          <p className="mt-1 text-sm text-gray-500">
            {standings.scope === 'combined'
              ? 'Combined standings across all squads'
              : 'Standings grouped by squad'}
            · Auto-refreshes every 30s
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6 space-y-8">
        {standings.scope === 'combined' ? (
          <StandingsTable entries={standings.standings} />
        ) : (
          standings.standings.map((group) => (
            <section key={group.squadId}>
              <h2 className="mb-3 text-base font-semibold text-gray-900">
                {group.squadName}
              </h2>
              <StandingsTable entries={group.entries} />
            </section>
          ))
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <Medal className="h-3.5 w-3.5 text-yellow-500" />
          Gold
        </span>
        <span className="flex items-center gap-1.5">
          <Medal className="h-3.5 w-3.5 text-gray-400" />
          Silver
        </span>
        <span className="flex items-center gap-1.5">
          <Medal className="h-3.5 w-3.5 text-orange-400" />
          Bronze
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            Cut
          </span>
          Below cut line
        </span>
      </div>
    </div>
  )
}
