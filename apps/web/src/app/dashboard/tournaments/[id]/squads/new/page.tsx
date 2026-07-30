'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import { ArrowLeft, Loader2, Plus } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

interface StageOption {
  id: string
  name: string
  sortOrder: number
}

interface TournamentDetail {
  id: string
  name: string
  stages: StageOption[]
}

// ─── Component ──────────────────────────────────────────────────────

export default function NewSquadPage() {
  const params = useParams()
  const router = useRouter()
  const tournamentId = params.id as string

  const { data: rawData, isLoading, error } = trpc.tournament.organizerById.useQuery(tournamentId)
  const tournament = rawData as TournamentDetail | undefined

  const createSquad = trpc.squad.create.useMutation({
    onSuccess: () => {
      router.push(`/dashboard/tournaments/${tournamentId}`)
    },
  })

  const [stageId, setStageId] = useState('')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [laneStart, setLaneStart] = useState('')
  const [laneEnd, setLaneEnd] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

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

  if (error || !tournament) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-600">
          {error?.message === 'NOT_FOUND' ? 'Tournament not found.' : 'Failed to load tournament.'}
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

  // ─── Empty stages state ─────────────────────────────────────────

  if (tournament.stages.length === 0) {
    return (
      <div>
        <Link
          href={`/dashboard/tournaments/${tournamentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tournament
        </Link>

        <div className="mt-12 rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Plus className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No stages configured</h3>
          <p className="mt-2 text-sm text-gray-500">
            Create stages for this tournament before adding squads.
          </p>
          <Link
            href={`/dashboard/tournaments/${tournamentId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Back to tournament
          </Link>
        </div>
      </div>
    )
  }

  // ─── Handlers ───────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!stageId) {
      setFormError('Please select a stage.')
      return
    }
    if (!name.trim()) {
      setFormError('Please enter a squad name.')
      return
    }
    if (!date) {
      setFormError('Please select a date.')
      return
    }
    if (!startTime) {
      setFormError('Please enter a start time.')
      return
    }

    const laneStartNum = laneStart ? parseInt(laneStart, 10) : undefined
    const laneEndNum = laneEnd ? parseInt(laneEnd, 10) : undefined

    if (laneStartNum !== undefined && laneEndNum !== undefined && laneStartNum > laneEndNum) {
      setFormError('Lane start must be less than or equal to lane end.')
      return
    }

    createSquad.mutate({
      stageId,
      name: name.trim(),
      date: new Date(date).toISOString(),
      startTime,
      laneStart: laneStartNum,
      laneEnd: laneEndNum,
      maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : undefined,
    })
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
      <div className="mt-3 mb-8">
        <h1 className="text-xl font-bold text-gray-900">Create Squad</h1>
        <p className="mt-1 text-sm text-gray-500">{tournament.name}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
        {/* Stage select */}
        <div>
          <label htmlFor="stage" className="block text-sm font-medium text-gray-700">
            Stage <span className="text-red-500">*</span>
          </label>
          <select
            id="stage"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a stage...</option>
            {tournament.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </div>

        {/* Squad name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Squad Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Squad A, Morning Session"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Start time */}
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">
            Start Time <span className="text-red-500">*</span>
          </label>
          <input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Lane range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="laneStart" className="block text-sm font-medium text-gray-700">
              Lane Start
            </label>
            <input
              id="laneStart"
              type="number"
              min={1}
              value={laneStart}
              onChange={(e) => setLaneStart(e.target.value)}
              placeholder="e.g. 1"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="laneEnd" className="block text-sm font-medium text-gray-700">
              Lane End
            </label>
            <input
              id="laneEnd"
              type="number"
              min={1}
              value={laneEnd}
              onChange={(e) => setLaneEnd(e.target.value)}
              placeholder="e.g. 10"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Max players */}
        <div>
          <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700">
            Max Players
          </label>
          <input
            id="maxPlayers"
            type="number"
            min={1}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
            placeholder="Leave empty for unlimited"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Form error */}
        {formError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{formError}</p>
          </div>
        )}

        {/* Mutation error */}
        {createSquad.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{createSquad.error?.message ?? 'Failed to create squad.'}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={createSquad.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {createSquad.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Squad
              </>
            )}
          </button>
          <Link
            href={`/dashboard/tournaments/${tournamentId}`}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
