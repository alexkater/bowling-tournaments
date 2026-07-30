'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import {
  Users,
  Plus,
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Clock3,
  XCircle,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

interface SquadRow {
  id: string
  stageId: string
  name: string
  date: string | Date
  startTime: string
  status: string
  laneStart: number | null
  laneEnd: number | null
  maxPlayers: number | null
  sortOrder: number
}

interface TournamentDetail {
  id: string
  name: string
  stages: Array<{
    id: string
    name: string
    sortOrder: number
  }>
}

// ─── Constants ──────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: {
    label: 'Pending',
    icon: <Clock3 className="h-3.5 w-3.5" />,
    className: 'bg-yellow-100 text-yellow-700 ring-yellow-300',
  },
  active: {
    label: 'Active',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: 'bg-green-100 text-green-700 ring-green-300',
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: 'bg-blue-100 text-blue-700 ring-blue-300',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <XCircle className="h-3.5 w-3.5" />,
    className: 'bg-red-100 text-red-700 ring-red-300',
  },
}

// ─── Component ──────────────────────────────────────────────────────

export default function SquadsPage() {
  const params = useParams()
  const tournamentId = params.id as string

  const { data: rawData, isLoading: tournamentLoading, error: tournamentError } =
    trpc.tournament.organizerById.useQuery(tournamentId)
  const tournament = rawData as TournamentDetail | undefined

  const { data: squadsData, isLoading: squadsLoading } = trpc.squad.list.useQuery(
    { tournamentId },
    { enabled: !!tournament },
  )
  const squads = (squadsData ?? []) as unknown as SquadRow[]

  const stageMap = new Map<string, string>()
  for (const stage of tournament?.stages ?? []) {
    stageMap.set(stage.id, stage.name)
  }

  const isLoading = tournamentLoading || squadsLoading

  // ─── Loading state ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="h-64 rounded-lg bg-gray-100" />
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────

  if (tournamentError || !tournament) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-600">
          {tournamentError?.message === 'NOT_FOUND' ? 'Tournament not found.' : 'Failed to load tournament.'}
        </p>
        <Link
          href="/dashboard/tournaments"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tournaments
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
      <div className="mt-3 mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Squads</h2>
          <p className="text-sm text-gray-500">
            {tournament.name} &middot; {squads.length} squad{squads.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href={`/dashboard/tournaments/${tournamentId}/squads/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Squad
        </Link>
      </div>

      {/* Empty state */}
      {squads.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No squads yet</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create your first squad to organize players into sessions.
          </p>
          <Link
            href={`/dashboard/tournaments/${tournamentId}/squads/new`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Squad
          </Link>
        </div>
      ) : (
        /* Squad list */
        <div className="space-y-3">
          {squads.map((squad) => {
            const statusStyle = STATUS_STYLES[squad.status] ?? STATUS_STYLES.pending!
            const stageName = stageMap.get(squad.stageId) ?? 'Unknown Stage'

            return (
              <div
                key={squad.id}
                className="rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">{squad.name}</h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyle.className}`}
                      >
                        {statusStyle.icon}
                        {statusStyle.label}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(squad.date).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {squad.startTime}
                      </span>
                      {squad.laneStart && squad.laneEnd && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          Lanes {squad.laneStart}-{squad.laneEnd}
                        </span>
                      )}
                      <span className="text-gray-400">{stageName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <SquadPlayerCount squadId={squad.id} maxPlayers={squad.maxPlayers} />
                    <Link
                      href={`/dashboard/tournaments/${tournamentId}/squads/${squad.id}/scores`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Scores
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Squad Player Count ─────────────────────────────────────────────

function SquadPlayerCount({ squadId, maxPlayers }: { squadId: string; maxPlayers: number | null }) {
  const { data: squadDetail } = trpc.squad.byId.useQuery(squadId)
  const count = squadDetail?.players?.length ?? 0

  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-500">
      <Users className="h-3.5 w-3.5" />
      {count}
      {maxPlayers ? ` / ${maxPlayers}` : ''}
    </span>
  )
}
