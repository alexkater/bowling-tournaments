'use client'

import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import { Plus, Trophy, Calendar, BarChart3, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const { data, isLoading } = trpc.tournament.organizerList.useQuery({ limit: 50 })
  const tournaments = data?.items ?? []

  const activeCount = tournaments.filter((t) => t.status === 'in_progress').length
  const upcomingCount = tournaments.filter((t) => t.status === 'published').length

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-steel-500">Overview of your tournaments</p>
        </div>
        <Link
          href="/dashboard/tournaments/new"
          className="inline-flex items-center gap-2 rounded-xl bg-pin-400 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pin-500 transition-colors shadow-lg shadow-pin-400/20"
        >
          <Plus className="h-4 w-4" /> Create Tournament
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <StatCard icon={<BarChart3 className="h-5 w-5" />} title="Active" value={activeCount} desc="In progress" />
        <StatCard icon={<Calendar className="h-5 w-5" />} title="Upcoming" value={upcomingCount} desc="Scheduled" />
        <StatCard icon={<Trophy className="h-5 w-5" />} title="Total" value={tournaments.length} desc="All time" />
      </div>

      {/* Recent tournaments */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">Recent Tournaments</h2>
        {isLoading ? (
          <div className="mt-4 rounded-2xl border border-white/5 bg-ink-800/50 p-12 text-center">
            <p className="text-steel-500">Loading...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/5 bg-ink-800/50 p-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-steel-700" />
            <p className="mt-4 text-steel-400">No tournaments yet</p>
            <p className="mt-1 text-sm text-steel-600">Create your first tournament to get started</p>
            <Link href="/dashboard/tournaments/new" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-pin-400 px-6 py-2.5 text-sm font-semibold text-white hover:bg-pin-500 transition-colors">
              Create Tournament <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/tournaments/${t.id}`}
                className="block rounded-xl border border-white/5 bg-ink-800/50 p-5 transition hover:border-white/10 hover:bg-ink-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{t.name}</p>
                    <p className="mt-0.5 text-sm text-steel-500">
                      {new Date(t.startDate).toLocaleDateString()} — {t.category}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                    t.status === 'published' ? 'bg-green-500/10 text-green-400' :
                    t.status === 'in_progress' ? 'bg-pin-400/10 text-pin-400' :
                    t.status === 'draft' ? 'bg-steel-500/10 text-steel-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    {t.status}
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

function StatCard({ icon, title, value, desc }: { icon: React.ReactNode; title: string; value: number; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-ink-800/50 p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-steel-400">{title}</p>
        <div className="text-steel-600">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-steel-600">{desc}</p>
    </div>
  )
}
