'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import {
  Trophy,
  ArrowLeft,
  Calendar,
  Users,
  Tag,
  ListOrdered,
  Swords,
  Grid3X3,
  Medal,
  DollarSign,
  FileText,
} from 'lucide-react'
import type { TournamentStatus, StageFormatType, AdvancementType } from '@bowling/shared'

// ─── Constants ───────────────────────────────────────────────────

const STATUS_STYLES: Record<TournamentStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 ring-gray-300',
  published: 'bg-green-100 text-green-700 ring-green-300',
  in_progress: 'bg-blue-100 text-blue-700 ring-blue-300',
  completed: 'bg-indigo-100 text-indigo-700 ring-indigo-300',
  cancelled: 'bg-red-100 text-red-700 ring-red-300',
}

const CATEGORY_LABELS: Record<string, string> = {
  open: 'Open',
  women: 'Women',
  senior: 'Senior',
  youth: 'Youth',
  mixed: 'Mixed',
}

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
  final: 'Final',
}

interface Tab {
  id: string
  label: string
  icon: React.ReactNode
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: <Trophy className="h-4 w-4" /> },
  { id: 'standings', label: 'Standings', icon: <ListOrdered className="h-4 w-4" /> },
  { id: 'brackets', label: 'Brackets', icon: <Swords className="h-4 w-4" /> },
  { id: 'sidepots', label: 'Sidepots', icon: <DollarSign className="h-4 w-4" /> },
  { id: 'players', label: 'Players', icon: <Users className="h-4 w-4" /> },
  { id: 'reports', label: 'Reports', icon: <FileText className="h-4 w-4" /> },
]

// ─── Types for the API response ──────────────────────────────────

interface StageDisplay {
  id: string
  tournamentId: string
  name: string
  sortOrder: number
  format: { type: string }
  advancement: { type: string }
  squadConfig: Record<string, unknown> | null
  standingsScope: string
}

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
  stages: StageDisplay[]
}

// ─── Component ───────────────────────────────────────────────────

export default function TournamentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [activeTab, setActiveTab] = useState('overview')

  const { data: rawData, isLoading, error } = trpc.tournament.organizerById.useQuery(id)
  const tournament = rawData as TournamentDetail | undefined

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-4 w-48 rounded bg-gray-100" />
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-gray-100" />
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-600">
          {error?.message === 'NOT_FOUND' ? 'Tournament not found.' : 'Failed to load tournament.'}
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

  const status = tournament.status as TournamentStatus

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard/tournaments"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Tournaments
      </Link>

      {/* Header */}
      <div className="mt-3 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <Trophy className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}>
                {status.replace('_', ' ')}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(tournament.startDate).toLocaleDateString()} — {new Date(tournament.endDate).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {CATEGORY_LABELS[tournament.category] ?? tournament.category}
              </span>
              {tournament.maxPlayers && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Max {tournament.maxPlayers} players
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mt-8 border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <OverviewTab tournament={tournament} />
        )}
        {activeTab !== 'overview' && (
          <PlaceholderTab label={TABS.find((t) => t.id === activeTab)?.label ?? activeTab} />
        )}
      </div>
    </div>
  )
}

// ─── Overview Tab ────────────────────────────────────────────────

function OverviewTab({ tournament }: { tournament: TournamentDetail }) {
  const stages = tournament.stages ?? []

  return (
    <div className="space-y-8">
      {/* Description */}
      {tournament.description && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Description</h3>
          <p className="mt-2 text-sm text-gray-600">{tournament.description}</p>
        </div>
      )}

      {/* Details grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Details</h3>
        <dl className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dt className="text-xs text-gray-500">Status</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900 capitalize">{tournament.status.replace('_', ' ')}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dt className="text-xs text-gray-500">Category</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{CATEGORY_LABELS[tournament.category] ?? tournament.category}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dt className="text-xs text-gray-500">Max Players</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{tournament.maxPlayers ?? 'Unlimited'}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dt className="text-xs text-gray-500">Start Date</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{new Date(tournament.startDate).toLocaleDateString()}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dt className="text-xs text-gray-500">End Date</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">{new Date(tournament.endDate).toLocaleDateString()}</dd>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <dt className="text-xs text-gray-500">Registration Deadline</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {tournament.registrationDeadline
                ? new Date(tournament.registrationDeadline).toLocaleDateString()
                : 'None'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Stages */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Stages ({stages.length})
        </h3>
        {stages.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No stages configured.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {stages.map((stage, index) => (
              <div key={stage.id ?? index} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium text-gray-600">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{stage.name}</p>
                      <p className="text-sm text-gray-500">
                        {FORMAT_LABELS[stage.format.type as StageFormatType] ?? stage.format.type}
                        {' · '}
                        {ADVANCEMENT_LABELS[stage.advancement.type as AdvancementType] ?? stage.advancement.type}
                      </p>
                    </div>
                  </div>
                  {index === stages.length - 1 && (
                    <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Final
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Placeholder Tab ─────────────────────────────────────────────

function PlaceholderTab({ label }: { label: string }) {
  const icons: Record<string, React.ReactNode> = {
    Standings: <ListOrdered className="h-12 w-12" />,
    Brackets: <Grid3X3 className="h-12 w-12" />,
    Sidepots: <DollarSign className="h-12 w-12" />,
    Players: <Users className="h-12 w-12" />,
    Reports: <FileText className="h-12 w-12" />,
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        {icons[label] ?? <Medal className="h-12 w-12" />}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{label}</h3>
      <p className="mt-2 text-sm text-gray-500">
        This section is coming soon. Check back after the next update.
      </p>
    </div>
  )
}
