'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import { Loader2, AlertCircle, UserPlus } from 'lucide-react'
import { LogoMark } from '@/components/Logo'

export default function SignupPage() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState<'organizer' | 'player'>('organizer')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('type') === 'player') {
      setAccountType('player')
    }
  }, [])

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token)
      router.push(data.profile.role === 'player' ? '/tournaments' : '/dashboard')
    },
    onError: (err) => setError(err.message),
  })

  function validate(): string | null {
    if (!firstName.trim()) return 'First name is required'
    if (!lastName.trim()) return 'Last name is required'
    if (!email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format'
    if (!password) return 'Password is required'
    if (password.length < 6) return 'Password must be at least 6 characters'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    const v = validate(); if (v) { setError(v); return }
    signupMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
      accountType,
    })
  }

  return (
    <div className="flex min-h-screen bg-ink-900">
      <div className="hidden w-[480px] bg-gradient-to-br from-ink-800 to-ink-900 lg:flex lg:flex-col lg:justify-between lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pin-400/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <Link href="/" className="relative flex items-center gap-3">
          <LogoMark className="h-8 w-auto" />
          <span className="text-xl font-bold text-white">Strike Manager</span>
        </Link>
        <div className="relative mb-12">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Start managing<br />tournaments today
          </h2>
          <p className="mt-3 text-steel-400">Create your free account. No credit card required during beta.</p>
        </div>
        <p className="relative text-sm text-steel-600">&copy; {new Date().getFullYear()}</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex justify-center">
            <Link href="/"><LogoMark className="h-10 w-auto" /></Link>
          </div>
          <div className="rounded-2xl border border-white/5 bg-ink-800/50 p-8">
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="mt-1 text-sm text-steel-500">Free during beta. Set up in under a minute.</p>
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-ink-900 p-1" role="group" aria-label="Account type">
              {(['player', 'organizer'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={accountType === type}
                  onClick={() => setAccountType(type)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                    accountType === type
                      ? 'bg-pin-400 text-white'
                      : 'text-steel-400 hover:text-white'
                  }`}
                >
                  {type === 'player' ? 'I am a player' : 'I organize tournaments'}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-steel-300">First name</label>
                  <input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" autoComplete="given-name" className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder-steel-600 focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20 transition-all" />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-steel-300">Last name</label>
                  <input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" autoComplete="family-name" className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder-steel-600 focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20 transition-all" />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-steel-300">Email address</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder-steel-600 focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20 transition-all" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-steel-300">Password</label>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder-steel-600 focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20 transition-all" />
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-pin-400/10 border border-pin-400/20 p-4 text-sm text-pin-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <button type="submit" disabled={signupMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-pin-400 px-4 py-3 text-sm font-semibold text-white hover:bg-pin-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-lg shadow-pin-400/20">
                {signupMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account...</> : <><UserPlus className="h-4 w-4" /> Create account</>}
              </button>
            </form>
          </div>
          <p className="mt-6 text-center text-sm text-steel-600">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-steel-300 hover:text-white transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
