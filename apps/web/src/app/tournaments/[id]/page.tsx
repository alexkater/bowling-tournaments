'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, CalendarDays, CheckCircle, Clock, ListChecks, Loader2, LogIn, Trophy, UserPlus, Users, XCircle } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { DocumentsSection } from '@/components/DocumentsSection'
import { trpc } from '@/lib/trpc-provider'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export default function PublicTournamentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const tournamentQuery = trpc.tournament.byId.useQuery(id, { enabled: Boolean(id) })

  // Check auth state
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 30_000 })
  const isLoggedIn = Boolean(meQuery.data)
  const isPlayer = meQuery.data?.role === 'player'

  // Check enrollment state for logged-in players
  const myTournamentsQuery = trpc.enrollment.myTournaments.useQuery(undefined, {
    enabled: isLoggedIn && isPlayer,
    staleTime: 15_000,
  })
  const enrollment = myTournamentsQuery.data?.find((e) => e.tournamentId === id)

  // Registration mutation
  const utils = trpc.useUtils()
  const [registering, setRegistering] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  const registerMutation = trpc.enrollment.register.useMutation({
    onMutate: () => { setRegistering(true); setRegisterError(null) },
    onSettled: () => setRegistering(false),
    onSuccess: () => {
      myTournamentsQuery.refetch()
      tournamentQuery.refetch()
    },
    onError: (err) => setRegisterError(err.message),
  })

  const cancelMutation = trpc.enrollment.cancel.useMutation({
    onMutate: () => setCancelling(true),
    onSettled: () => setCancelling(false),
    onSuccess: () => {
      myTournamentsQuery.refetch()
      tournamentQuery.refetch()
    },
  })

  const handleRegister = () => registerMutation.mutate({ tournamentId: id })
  const handleCancel = () => cancelMutation.mutate({ tournamentId: id })

  if (tournamentQuery.isLoading) {
    return (
      <div className="min-h-screen bg-ink-900 px-6 py-24">
        <div className="mx-auto h-96 max-w-4xl animate-pulse rounded-2xl bg-ink-800" />
      </div>
    )
  }

  if (!tournamentQuery.data || tournamentQuery.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6 text-center">
        <div>
          <Trophy className="mx-auto h-14 w-14 text-steel-700" />
          <h1 className="mt-5 text-2xl font-bold text-white">Tournament not available</h1>
          <p className="mt-2 text-steel-500">It may not be published or may no longer exist.</p>
          <Link href="/tournaments" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-pin-400 px-5 py-3 font-semibold text-white hover:bg-pin-500">
            <ArrowLeft className="h-4 w-4" /> Browse tournaments
          </Link>
        </div>
      </div>
    )
  }

  const tournament = tournamentQuery.data

  const canRegister = tournament.status === 'published' || tournament.status === 'in_progress'
  const deadlinePassed = tournament.registrationDeadline && new Date() > new Date(tournament.registrationDeadline)

  return (
    <div className="min-h-screen bg-ink-900 text-steel-200">
      <header className="border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/"><Logo className="h-8 w-auto" /></Link>
          <Link href="/tournaments" className="inline-flex items-center gap-2 text-sm font-medium text-steel-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All tournaments
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-ink-800 to-ink-900 p-8 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-pin-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pin-300">
              {tournament.status.replace('_', ' ')}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-steel-400">
              {tournament.category}
            </span>
          </div>
          <h1 className="mt-5 text-3xl font-bold text-white sm:text-5xl">{tournament.name}</h1>
          {tournament.description && (
            <p className="mt-5 max-w-3xl text-lg leading-8 text-steel-400">{tournament.description}</p>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard icon={<CalendarDays className="h-5 w-5" />} label="Starts" value={formatDate(tournament.startDate)} />
            <InfoCard icon={<Clock className="h-5 w-5" />} label="Ends" value={formatDate(tournament.endDate)} />
            <InfoCard icon={<Users className="h-5 w-5" />} label="Capacity" value={tournament.maxPlayers ? `${tournament.maxPlayers} players` : 'Open'} />
            <InfoCard
              icon={<ListChecks className="h-5 w-5" />}
              label="Registration"
              value={tournament.registrationDeadline ? `Until ${formatDate(tournament.registrationDeadline)}` : 'Open until event'}
            />
          </div>
        </div>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="text-xl font-bold text-white">Tournament format</h2>
            <div className="mt-4 space-y-3">
              {tournament.stages.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-ink-800/60 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pin-400/10 font-bold text-pin-300">{index + 1}</div>
                  <div>
                    <h3 className="font-semibold text-white">{stage.name}</h3>
                    <p className="mt-1 text-sm text-steel-500">Stage {index + 1} of {tournament.stages.length}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tournament documents */}
            <DocumentsSection tournamentId={id} />
          </div>

          {/* ── Registration sidebar ── */}
          <aside className="h-fit rounded-2xl border border-pin-400/20 bg-pin-400/5 p-6">
            {!canRegister || deadlinePassed ? (
              <>
                <h2 className="text-lg font-bold text-white">Registration closed</h2>
                <p className="mt-2 text-sm text-steel-400">
                  {deadlinePassed ? 'The registration deadline has passed.' : 'This tournament is not currently accepting registrations.'}
                </p>
              </>
            ) : enrollment ? (
              <>
                {enrollment.status === 'confirmed' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                      <h2 className="text-lg font-bold text-white">You're registered!</h2>
                    </div>
                    <p className="mt-1 text-sm text-steel-400">Your spot is confirmed.</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-400" />
                      <h2 className="text-lg font-bold text-white">On waitlist</h2>
                    </div>
                    <p className="mt-1 text-sm text-steel-400">You'll be notified if a spot opens up.</p>
                  </>
                )}

                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-400/20 disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Cancel registration
                </button>

                <Link
                  href="/player/tournaments"
                  className="mt-3 block text-center text-sm font-medium text-steel-400 hover:text-white"
                >
                  View my tournaments →
                </Link>
              </>
            ) : isLoggedIn && isPlayer ? (
              <>
                <h2 className="text-lg font-bold text-white">Ready to compete?</h2>
                <p className="mt-2 text-sm leading-6 text-steel-400">Click below to register for this tournament.</p>

                {registerError && (
                  <p className="mt-3 rounded-lg bg-red-400/10 px-3 py-2 text-xs text-red-300">{registerError}</p>
                )}

                <button
                  onClick={handleRegister}
                  disabled={registering}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-pin-400 px-4 py-3 text-sm font-semibold text-white hover:bg-pin-500 disabled:opacity-50"
                >
                  {registering ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Register now
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-white">Ready to compete?</h2>
                <p className="mt-2 text-sm leading-6 text-steel-400">Create a player account to manage registrations and follow your results.</p>
                <Link
                  href="/signup?type=player"
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-pin-400 px-4 py-3 text-sm font-semibold text-white hover:bg-pin-500"
                >
                  <UserPlus className="h-4 w-4" />
                  Create player account
                </Link>
                <Link href="/login" className="mt-3 flex items-center justify-center gap-1 text-center text-sm font-medium text-steel-400 hover:text-white">
                  <LogIn className="h-3.5 w-3.5" /> Already registered? Sign in
                </Link>
              </>
            )}
          </aside>
        </section>
      </main>
    </div>
  )
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
      <div className="text-pin-400">{icon}</div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-steel-600">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  )
}
