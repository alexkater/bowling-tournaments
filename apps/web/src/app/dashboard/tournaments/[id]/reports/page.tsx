'use client'

import { useParams } from 'next/navigation'
import { useRef } from 'react'
import { trpc } from '@/lib/trpc-provider'
import { Printer, Trophy } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────

interface TournamentDetail {
  id: string
  name: string
  description: string | null
  organizationId: string
  centerId?: string
  status: string
  category: string
  maxPlayers: number | null
  allowWaitlist: boolean
  startDate: string
  endDate: string
  registrationDeadline: string | null
  createdAt: string
  updatedAt: string
  stages: Array<{
    id: string
    tournamentId: string
    name: string
    sortOrder: number
    format: { type: string }
    advancement: { type: string }
    squadConfig: Record<string, unknown> | null
    standingsScope: string
  }>
}

interface StandingsEntry {
  rank: number
  playerId: string
  playerName: string
  totalRaw: number
  totalHandicap: number
  games: Array<{
    id: string
    tournamentPlayerId: string
    gameNumber: number
    rawScore: number
    handicapScore: number | null
    pins: number[]
  }>
  behind: number
  isCut: boolean
}

interface CombinedStandings {
  scope: 'combined'
  standings: StandingsEntry[]
}

interface PerSquadStandingsGroup {
  squadId: string
  squadName: string
  entries: StandingsEntry[]
}

interface PerSquadStandings {
  scope: 'per_squad'
  standings: PerSquadStandingsGroup[]
}

type TournamentStandings = CombinedStandings | PerSquadStandings

// ─── Main Page ───────────────────────────────────────────────────

export default function ReportsPage() {
  const params = useParams()
  const tournamentId = params.id as string
  const printRef = useRef<HTMLDivElement>(null)

  const { data: rawData, isLoading: tournamentLoading } = trpc.tournament.organizerById.useQuery(tournamentId)
  const tournament = rawData as TournamentDetail | undefined

  const { data: standingsData, isLoading: standingsLoading } = trpc.standings.getByTournament.useQuery(
    tournamentId,
    { enabled: !!tournament },
  )

  const isLoading = tournamentLoading || standingsLoading

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="h-64 rounded-lg bg-gray-100" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-600">Failed to load tournament.</p>
      </div>
    )
  }

  const standings = standingsData as TournamentStandings | undefined

  return (
    <div>
      {/* Header (hidden when printing) */}
      <div className="no-print mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reports</h2>
          <p className="text-sm text-gray-500">Printable tournament standings</p>
        </div>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      {/* Printable content */}
      <div ref={printRef}>
        <div className="rounded-lg border border-gray-200 bg-white p-8 print:border-none print:p-0">
          {/* Report header */}
          <div className="text-center mb-8 print:mb-6">
            <div className="flex items-center justify-center gap-2 text-gray-900 mb-1">
              <Trophy className="h-6 w-6 text-blue-600 print:h-5 print:w-5" />
              <h1 className="text-2xl font-bold print:text-xl">{tournament.name}</h1>
            </div>
            <p className="text-sm text-gray-500">
              {new Date(tournament.startDate).toLocaleDateString()}
              {tournament.endDate !== tournament.startDate && (
                <> — {new Date(tournament.endDate).toLocaleDateString()}</>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-1 capitalize">
              {tournament.category} &middot; {tournament.status.replace('_', ' ')}
            </p>
          </div>

          {/* Standings */}
          {!standings ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No standings data available.</p>
            </div>
          ) : standings.scope === 'combined' ? (
            <StandingsTable
              title="Final Standings"
              entries={(standings as CombinedStandings).standings}
            />
          ) : (
            <div className="space-y-8">
              {(standings as PerSquadStandings).standings.map((group) => (
                <StandingsTable
                  key={group.squadId}
                  title={group.squadName}
                  entries={group.entries}
                />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400 print:mt-6">
            <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 0.75in;
          }
        }
      `}</style>
    </div>
  )
}

// ─── Standings Table ─────────────────────────────────────────────

function StandingsTable({
  title,
  entries,
}: {
  title: string
  entries: StandingsEntry[]
}) {
  if (entries.length === 0) {
    return (
      <div className="mb-6">
        <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
        <p className="text-sm text-gray-400">No entries.</p>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <h3 className="text-base font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Player
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Handicap
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Behind
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Games
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <tr
                key={entry.playerId}
                className={`${
                  entry.isCut ? 'text-gray-400' : ''
                } ${
                  entry.rank <= 3 ? 'bg-yellow-50/50' : ''
                } hover:bg-gray-50 transition-colors`}
              >
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {entry.rank === 1 && <Trophy className="h-3.5 w-3.5 text-yellow-500" />}
                    <span className={`font-medium ${
                      entry.rank === 1 ? 'text-yellow-700' :
                      entry.rank === 2 ? 'text-gray-600' :
                      entry.rank === 3 ? 'text-amber-700' :
                      'text-gray-700'
                    }`}>
                      {entry.rank}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 font-medium text-gray-900">
                  {entry.playerName}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-900">
                  {entry.totalRaw}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-600">
                  {entry.totalHandicap !== entry.totalRaw
                    ? entry.totalHandicap
                    : '—'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-gray-400">
                  {entry.behind > 0 ? `+${entry.behind}` : '—'}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-500">
                  {entry.games.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
