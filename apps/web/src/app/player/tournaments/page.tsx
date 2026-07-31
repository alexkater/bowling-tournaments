'use client'

import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle, ChevronRight, Clock, Loader2, LogIn, MapPin, Trophy, UserPlus, XCircle } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { trpc } from '@/lib/trpc-provider'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export default function MyTournamentsPage() {
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 30_000 })
  const myTournamentsQuery = trpc.enrollment.myTournaments.useQuery(undefined, {
    enabled: Boolean(meQuery.data),
    staleTime: 15_000,
  })

  const isLoggedIn = Boolean(meQuery.data)
  const isPlayer = meQuery.data?.role === 'player'

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6 text-center">
        <div>
          <Trophy className="mx-auto h-14 w-14 text-steel-700" />
          <h1 className="mt-5 text-2xl font-bold text-white">Sign in to view your tournaments</h1>
          <p className="mt-2 text-steel-500">You need a player account to manage registrations.</p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-pin-400 px-5 py-3 font-semibold text-white hover:bg-pin-500">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
            <Link href="/signup?type=player" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 font-semibold text-white hover:bg-white/5">
              <UserPlus className="h-4 w-4" /> Create account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!isPlayer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6 text-center">
        <div>
          <Trophy className="mx-auto h-14 w-14 text-steel-700" />
          <h1 className="mt-5 text-2xl font-bold text-white">Organizer account</h1>
          <p className="mt-2 text-steel-500">This area is for players. Use the dashboard to manage your tournaments.</p>
          <Link href="/dashboard" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-pin-400 px-5 py-3 font-semibold text-white hover:bg-pin-500">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (myTournamentsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-ink-900 px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-800" />
          <div className="mt-6 space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-ink-800" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const enrollments = myTournamentsQuery.data ?? []
  const confirmed = enrollments.filter((e) => e.status === 'confirmed')
  const waitlisted = enrollments.filter((e) => e.status === 'waitlisted')

  return (
    <div className="min-h-screen bg-ink-900 text-steel-200">
      <header className="border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/"><Logo className="h-8 w-auto" /></Link>
          <Link href="/tournaments" className="inline-flex items-center gap-2 text-sm font-medium text-steel-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Discover tournaments
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">My tournaments</h1>

        {enrollments.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/5 bg-ink-800/40 p-10 text-center">
            <Trophy className="mx-auto h-12 w-12 text-steel-700" />
            <h2 className="mt-4 text-lg font-semibold text-white">No tournaments yet</h2>
            <p className="mt-2 text-sm text-steel-500">Browse open tournaments and register to compete.</p>
            <Link href="/tournaments" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-pin-400 px-5 py-3 text-sm font-semibold text-white hover:bg-pin-500">
              Browse tournaments <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Confirmed */}
            {confirmed.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-400">Confirmed ({confirmed.length})</h2>
                </div>
                <div className="mt-3 space-y-3">
                  {confirmed.map((enrollment) => (
                    <Link
                      key={enrollment.id}
                      href={`/tournaments/${enrollment.tournamentId}`}
                      className="flex items-center justify-between rounded-2xl border border-white/5 bg-ink-800/40 p-5 transition hover:border-white/10 hover:bg-ink-800/60"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white truncate">{enrollment.tournamentName}</h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-steel-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(enrollment.tournamentStartDate)}
                          </span>
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium uppercase">
                            {enrollment.tournamentStatus.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-steel-600" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Waitlisted */}
            {waitlisted.length > 0 && (
              <section className="mt-8">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-400">Waitlisted ({waitlisted.length})</h2>
                </div>
                <div className="mt-3 space-y-3">
                  {waitlisted.map((enrollment) => (
                    <Link
                      key={enrollment.id}
                      href={`/tournaments/${enrollment.tournamentId}`}
                      className="flex items-center justify-between rounded-2xl border border-amber-400/10 bg-amber-400/5 p-5 transition hover:border-amber-400/20"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white truncate">{enrollment.tournamentName}</h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-steel-500">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(enrollment.tournamentStartDate)}
                          </span>
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium uppercase">
                            {enrollment.tournamentStatus.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="ml-4 h-4 w-4 shrink-0 text-steel-600" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
