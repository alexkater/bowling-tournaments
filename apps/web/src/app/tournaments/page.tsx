'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CalendarDays, CheckCircle, ChevronRight, Clock, LogIn, MapPin, Trophy, UserPlus, Users } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { trpc } from '@/lib/trpc-provider'

type PublicStatus = 'published' | 'in_progress' | 'completed'

const statusLabels: Record<PublicStatus, string> = {
  published: 'Upcoming',
  in_progress: 'Live',
  completed: 'Results',
}

function formatDateRange(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`
}

export default function PublicTournamentsPage() {
  const [status, setStatus] = useState<PublicStatus>('published')
  const tournamentsQuery = trpc.tournament.list.useQuery({ status, limit: 50 })
  const tournaments = tournamentsQuery.data?.items ?? []

  // Auth + enrollment state
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 30_000 })
  const isLoggedIn = Boolean(meQuery.data)
  const isPlayer = meQuery.data?.role === 'player'

  const myTournamentsQuery = trpc.enrollment.myTournaments.useQuery(undefined, {
    enabled: isLoggedIn && isPlayer,
    staleTime: 15_000,
  })
  const enrolledIds = new Set((myTournamentsQuery.data ?? []).map((e) => e.tournamentId))

  return (
    <div className="min-h-screen bg-ink-900 text-steel-200">
      <header className="border-b border-white/5 bg-ink-900/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" aria-label="Strike Manager home">
            <Logo className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {isLoggedIn && isPlayer && (
              <Link href="/player/tournaments" className="font-medium text-pin-300 hover:text-pin-200">
                My tournaments
              </Link>
            )}
            {isLoggedIn ? (
              <Link href={isPlayer ? '/player/tournaments' : '/dashboard'} className="font-medium text-steel-400 hover:text-white">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="font-medium text-steel-400 hover:text-white">Sign in</Link>
                <Link href="/signup?type=player" className="rounded-lg bg-pin-400 px-4 py-2 font-semibold text-white hover:bg-pin-500">
                  Player account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-pin-400">Compete</p>
          <h1 className="mt-3 text-4xl font-bold text-white sm:text-5xl">Find your next tournament</h1>
          <p className="mt-4 text-lg text-steel-400">
            Browse official events, check dates and formats, and follow live results.
          </p>
        </div>

        <div className="mt-10 inline-flex rounded-xl border border-white/5 bg-ink-800 p-1" role="tablist" aria-label="Tournament status">
          {(Object.keys(statusLabels) as PublicStatus[]).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => setStatus(value)}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
                status === value ? 'bg-pin-400 text-white' : 'text-steel-400 hover:text-white'
              }`}
            >
              {statusLabels[value]}
            </button>
          ))}
        </div>

        {tournamentsQuery.isLoading ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-ink-800" />)}
          </div>
        ) : tournamentsQuery.error ? (
          <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-red-200">
            Tournaments could not be loaded. Please try again.
          </div>
        ) : tournaments.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/5 bg-ink-800/60 p-12 text-center">
            <Trophy className="mx-auto h-12 w-12 text-steel-700" />
            <h2 className="mt-4 text-lg font-semibold text-white">No {statusLabels[status].toLowerCase()} tournaments</h2>
            <p className="mt-2 text-sm text-steel-500">New events will appear here as organizers publish them.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {tournaments.map((tournament) => {
              const isEnrolled = enrolledIds.has(tournament.id)
              return (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.id}`}
                  className={`group rounded-2xl border p-6 transition ${
                    isEnrolled
                      ? 'border-emerald-400/20 bg-emerald-400/5 hover:border-emerald-400/40'
                      : 'border-white/5 bg-ink-800/60 hover:border-pin-400/30 hover:bg-ink-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-pin-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pin-300">
                          {tournament.category}
                        </span>
                        {isEnrolled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                            <CheckCircle className="h-3 w-3" /> Registered
                          </span>
                        )}
                      </div>
                      <h2 className={`mt-4 text-xl font-bold text-white ${isEnrolled ? '' : 'group-hover:text-pin-300'}`}>
                        {tournament.name}
                      </h2>
                    </div>
                    <ChevronRight className={`mt-1 h-5 w-5 transition ${isEnrolled ? 'text-emerald-500' : 'text-steel-600 group-hover:translate-x-1 group-hover:text-pin-400'}`} />
                  </div>
                  <div className="mt-6 space-y-3 text-sm text-steel-400">
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-steel-600" />
                      {formatDateRange(tournament.startDate, tournament.endDate)}
                    </p>
                    <p className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-steel-600" />
                      {tournament.maxPlayers ? `Up to ${tournament.maxPlayers} players` : 'Open capacity'}
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-steel-600" />
                      Bowling center details on event page
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
