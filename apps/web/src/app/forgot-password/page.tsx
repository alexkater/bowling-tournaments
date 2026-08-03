'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { trpc } from '@/lib/trpc-provider'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const recovery = trpc.auth.forgotPassword.useMutation()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    recovery.mutate({ email: email.trim().toLowerCase() })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-ink-800/50 p-8">
        <Link href="/"><LogoMark className="mx-auto mb-6 h-10 w-auto" /></Link>
        {recovery.isSuccess ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-4 text-2xl font-bold text-white">Check your email</h1>
            <p className="mt-2 text-sm text-steel-400">
              If an account exists, a secure recovery link has been queued.
            </p>
            <Link href="/login" className="mt-6 inline-block text-sm font-semibold text-pin-300 hover:text-pin-200">
              Return to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-white">Forgot your password?</h1>
            <p className="mt-2 text-sm text-steel-400">Enter your account email. We will send a secure, one-time link.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-steel-300">Email address</label>
                <input
                  id="email"
                  type="email"
                  required
                  maxLength={320}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20"
                />
              </div>
              {recovery.error && (
                <div className="flex gap-2 rounded-xl border border-pin-400/20 bg-pin-400/10 p-4 text-sm text-pin-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{recovery.error.message}</span>
                </div>
              )}
              <button type="submit" disabled={recovery.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-pin-400 px-4 py-3 text-sm font-semibold text-white hover:bg-pin-500 disabled:opacity-50">
                {recovery.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send recovery link
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-steel-500">
              <Link href="/login" className="font-semibold text-steel-300 hover:text-white">Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
