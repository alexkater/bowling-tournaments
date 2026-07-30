'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { trpc } from '@/lib/trpc-provider'
import {
  Users,
  UserCheck,
  UserX,
  MapPin,
  Calendar,
  Tag,
  UserPlus,
  Plus,
  Search,
  Loader2,
  X,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

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
}

interface PlayerProfile {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  usbcId: string | null
  average: number | null
  handicap: number | null
  avatarUrl: string | null
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function PlayersPage() {
  const params = useParams()
  const tournamentId = params.id as string

  const { data: rawData, isLoading, error } = trpc.tournament.organizerById.useQuery(tournamentId)
  const tournament = rawData as TournamentDetail | undefined

  const { data: squadsData } = trpc.squad.list.useQuery(
    { tournamentId },
    { enabled: !!tournament },
  )
  const squads = (squadsData ?? []) as unknown as SquadRow[]

  const [showRegisterModal, setShowRegisterModal] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="h-64 rounded-lg bg-gray-100" />
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-600">Failed to load tournament.</p>
        <p className="mt-1 text-xs text-red-400">{error?.message}</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Player Roster</h2>
          <p className="text-sm text-gray-500">
            {tournament.name} &middot; {new Date(tournament.startDate).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => setShowRegisterModal(true)}
          disabled={squads.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          title={squads.length === 0 ? 'Create a squad before registering players' : undefined}
        >
          <UserPlus className="h-4 w-4" />
          Register Player
        </button>
      </div>

      {/* Tournament info cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            <span>Capacity</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {tournament.maxPlayers ?? 'Unlimited'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="h-4 w-4" />
            <span>Date</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {new Date(tournament.startDate).toLocaleDateString()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Tag className="h-4 w-4" />
            <span>Category</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-gray-900 capitalize">
            {tournament.category}
          </p>
        </div>
      </div>

      {/* Squads / Roster sections */}
      {squads.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No squads configured</h3>
          <p className="mt-2 text-sm text-gray-500">
            Squads must be created before players can register.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {squads.map((squad) => (
            <SquadRosterSection key={squad.id} squad={squad} />
          ))}
        </div>
      )}

      {/* Register Player Modal */}
      {showRegisterModal && (
        <RegisterPlayerModal
          tournamentId={tournamentId}
          squads={squads}
          onClose={() => setShowRegisterModal(false)}
        />
      )}
    </div>
  )
}

// ─── Squad Roster Section ───────────────────────────────────────────

function SquadRosterSection({ squad }: { squad: SquadRow }) {
  const { data: squadDetail } = trpc.squad.byId.useQuery(squad.id)

  const players = squadDetail?.players ?? []
  const checkedIn = players.filter((p: { checkedIn: boolean }) => p.checkedIn).length

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Squad header */}
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-900">{squad.name}</h3>
            <p className="text-sm text-gray-500">
              {new Date(squad.date).toLocaleDateString()} &middot; {squad.startTime}
              {squad.laneStart && squad.laneEnd && (
                <> &middot; Lanes {squad.laneStart}-{squad.laneEnd}</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-gray-500">
              <UserCheck className="h-3.5 w-3.5 text-green-500" />
              {checkedIn} checked in
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              <Users className="h-3.5 w-3.5" />
              {players.length}{squad.maxPlayers ? ` / ${squad.maxPlayers}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Player table */}
      {players.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-gray-400">No players registered in this squad yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lane
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {players.map((player: {
                id: string
                profileId: string
                lane: number | null
                checkedIn: boolean
              }) => (
                <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                        {player.profileId.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">
                        {player.profileId}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {player.lane ? (
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <MapPin className="h-3.5 w-3.5" />
                        Lane {player.lane}
                      </span>
                    ) : (
                      <span className="text-gray-400">&mdash;</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {player.checkedIn ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <UserCheck className="h-3 w-3" />
                        Checked In
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        <UserX className="h-3 w-3" />
                        Not Checked In
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Register Player Modal ──────────────────────────────────────────

function RegisterPlayerModal({
  tournamentId,
  squads,
  onClose,
}: {
  tournamentId: string
  squads: SquadRow[]
  onClose: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null)
  const [selectedSquadId, setSelectedSquadId] = useState(squads.length > 0 ? squads[0]!.id : '')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])

  const utils = trpc.useUtils()

  const { data: searchResults, isFetching: searching } = trpc.player.search.useQuery(
    searchQuery,
    { enabled: searchQuery.length >= 2 },
  )
  const results = (searchResults ?? []) as PlayerProfile[]

  const registerMutation = trpc.tournament.registerPlayer.useMutation({
    onSuccess: () => {
      utils.squad.list.invalidate({ tournamentId })
      utils.squad.byId.invalidate()
      onClose()
    },
  })

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
      setSelectedPlayer(null)
    },
    [],
  )

  const toggleEvent = useCallback((event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    )
  }, [])

  const handleRegister = useCallback(() => {
    if (!selectedPlayer || !selectedSquadId) return
    registerMutation.mutate({
      tournamentId,
      squadId: selectedSquadId,
      playerId: selectedPlayer.id,
    })
  }, [selectedPlayer, selectedSquadId, tournamentId, registerMutation])

  const EVENT_OPTIONS = [
    { value: 'singles', label: 'Singles' },
    { value: 'doubles', label: 'Doubles' },
    { value: 'trios', label: 'Trios' },
    { value: 'teams', label: 'Teams' },
    { value: 'all_events', label: 'All Events' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Register Player</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Search player */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Search Player
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Type at least 2 characters..."
                className="block w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>

            {/* Search results */}
            {searchQuery.length >= 2 && !selectedPlayer && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                {results.length === 0 && !searching ? (
                  <p className="px-3 py-4 text-center text-sm text-gray-400">
                    No players found.
                  </p>
                ) : (
                  results.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => {
                        setSelectedPlayer(player)
                        setSearchQuery(`${player.firstName} ${player.lastName}`)
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-600">
                        {player.firstName.charAt(0)}
                        {player.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {player.firstName} {player.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {player.average != null ? `Avg: ${player.average}` : 'No average'}
                          {player.usbcId ? ` · USBC: ${player.usbcId}` : ''}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected player badge */}
            {selectedPlayer && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-200 text-xs font-medium text-blue-700">
                  {selectedPlayer.firstName.charAt(0)}
                  {selectedPlayer.lastName.charAt(0)}
                </div>
                <span className="flex-1 text-sm font-medium text-gray-900">
                  {selectedPlayer.firstName} {selectedPlayer.lastName}
                </span>
                <button
                  onClick={() => {
                    setSelectedPlayer(null)
                    setSearchQuery('')
                  }}
                  className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Select squad */}
          <div>
            <label htmlFor="register-squad" className="block text-sm font-medium text-gray-700 mb-1.5">
              Squad
            </label>
            <select
              id="register-squad"
              value={selectedSquadId}
              onChange={(e) => setSelectedSquadId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {squads.map((squad) => (
                <option key={squad.id} value={squad.id}>
                  {squad.name} — {new Date(squad.date).toLocaleDateString()} {squad.startTime}
                </option>
              ))}
            </select>
          </div>

          {/* Event entries */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Event Entries
            </label>
            <div className="flex flex-wrap gap-2">
              {EVENT_OPTIONS.map((event) => (
                <button
                  key={event.value}
                  onClick={() => toggleEvent(event.value)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedEvents.includes(event.value)
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {selectedEvents.includes(event.value) && (
                    <Plus className="h-3 w-3 rotate-45" />
                  )}
                  {event.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">Optional. Select events this player is entering.</p>
          </div>

          {/* Error */}
          {registerMutation.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">
                {registerMutation.error?.message ?? 'Failed to register player.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRegister}
            disabled={!selectedPlayer || !selectedSquadId || registerMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Register
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
