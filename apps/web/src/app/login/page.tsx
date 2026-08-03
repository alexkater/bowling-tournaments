'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import { Loader2, AlertCircle, LogIn } from 'lucide-react'
import { LogoMark } from '@/components/Logo'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('auth_token', data.token)
      router.push(data.profile.role === 'player' ? '/tournaments' : '/dashboard')
    },
    onError: (err) => setError(err.message),
  })
  const resendMutation = trpc.auth.resendVerification.useMutation()

  function validate(): string | null {
    if (!email.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format'
    if (!password) return 'Password is required'
    if (password.length < 6) return 'Password must be at least 6 characters'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    const v = validate(); if (v) { setError(v); return }
    loginMutation.mutate({ email: email.trim(), password })
  }

  return (
    <div className="flex min-h-screen bg-ink-900">
      {/* Left — branding */}
      <div className="hidden w-[480px] bg-gradient-to-br from-ink-800 to-ink-900 lg:flex lg:flex-col lg:justify-between lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pin-400/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        <Link href="/" className="relative flex items-center gap-3">
          <LogoMark className="h-8 w-auto" />
          <span className="text-xl font-bold text-white">Strike Manager</span>
        </Link>
        <div className="relative mb-12">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Pick up where<br />you left off
          </h2>
          <p className="mt-3 text-steel-400">Sign in to manage your tournaments, brackets, and standings.</p>
        </div>
        <p className="relative text-sm text-steel-600">&copy; {new Date().getFullYear()}</p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden flex justify-center">
            <Link href="/"><LogoMark className="h-10 w-auto" /></Link>
          </div>
          <div className="rounded-2xl border border-white/5 bg-ink-800/50 p-8">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-steel-500">Enter your credentials to continue</p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-steel-300">Email address</label>
                <input id="email" type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder-steel-600 focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20 transition-all" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-steel-300">Password</label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-pin-300 hover:text-pin-200">Forgot password?</Link>
                </div>
                <input id="password" type="password" maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white placeholder-steel-600 focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20 transition-all" />
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-pin-400/10 border border-pin-400/20 p-4 text-sm text-pin-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {error?.toLowerCase().includes('verify your email') && (
                <button
                  type="button"
                  disabled={resendMutation.isPending || resendMutation.isSuccess || !email.trim()}
                  onClick={() => resendMutation.mutate({ email: email.trim().toLowerCase() })}
                  className="w-full rounded-xl border border-pin-400/30 px-4 py-2.5 text-sm font-semibold text-pin-200 hover:bg-pin-400/10 disabled:opacity-50"
                >
                  {resendMutation.isPending ? 'Sending...' : resendMutation.isSuccess ? 'Verification email queued' : 'Resend verification email'}
                </button>
              )}
              <button type="submit" disabled={loginMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-pin-400 px-4 py-3 text-sm font-semibold text-white hover:bg-pin-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-lg shadow-pin-400/20">
                {loginMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : <><LogIn className="h-4 w-4" /> Sign in</>}
              </button>
            </form>
          </div>
          <p className="mt-6 text-center text-sm text-steel-600">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-steel-300 hover:text-white transition-colors">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
