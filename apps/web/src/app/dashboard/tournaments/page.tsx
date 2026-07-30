'use client'

import { useState } from 'react'
import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import { Plus, Trophy, Filter } from 'lucide-react'
import type { TournamentStatus } from '@bowling/shared'

const STATUS_TABS: { label: string; value: TournamentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
]

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

export default function TournamentListPage() {
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | 'all'>('all')

  const { data, isLoading, error } = trpc.tournament.organizerList.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    limit: 50,
  })

  const tournaments = data?.items ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your bowling tournaments</p>
        </div>
        <Link
          href="/dashboard/tournaments/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Tournament
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="mt-6 flex items-center gap-2 border-b border-gray-200 pb-px">
        <Filter className="h-4 w-4 text-gray-400" />
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.value
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-5 w-48 rounded bg-gray-200" />
                    <div className="h-4 w-32 rounded bg-gray-100" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm text-red-600">Failed to load tournaments. Please try again.</p>
            <p className="mt-1 text-xs text-red-400">{error.message}</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">No tournaments yet</h3>
            <p className="mt-2 text-sm text-gray-500">
              {statusFilter === 'all'
                ? 'Get started by creating your first tournament.'
                : `No tournaments with status "${statusFilter}".`}
            </p>
            {statusFilter === 'all' && (
              <Link
                href="/dashboard/tournaments/new"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Tournament
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/tournaments/${t.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-5 transition hover:shadow-sm hover:border-gray-300"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-5 w-5 flex-shrink-0 text-gray-400" />
                      <p className="truncate text-base font-medium text-gray-900">{t.name}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-sm text-gray-500 ml-8">
                      <span>{new Date(t.startDate).toLocaleDateString()} — {new Date(t.endDate).toLocaleDateString()}</span>
                      <span className="text-gray-300">·</span>
                      <span>{CATEGORY_LABELS[t.category] ?? t.category}</span>
                      {t.maxPlayers && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span>Max {t.maxPlayers} players</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`ml-4 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[t.status as TournamentStatus] ?? STATUS_STYLES.draft}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
