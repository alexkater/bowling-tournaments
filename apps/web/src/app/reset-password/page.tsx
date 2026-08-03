'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { trpc } from '@/lib/trpc-provider'

function ResetPasswordContent() {
  const token = useSearchParams().get('token')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const reset = trpc.auth.resetPassword.useMutation()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setValidationError(null)
    if (!token) return setValidationError('This recovery link is incomplete.')
    if (password.length < 8) return setValidationError('Password must be at least 8 characters.')
    if (password !== confirmation) return setValidationError('Passwords do not match.')
    reset.mutate({ token, password })
  }

  return (
    <AuthShell>
      {reset.isSuccess ? (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-4 text-2xl font-bold text-white">Password updated</h1>
          <p className="mt-2 text-sm text-steel-400">Previous sessions were revoked. Sign in with your new password.</p>
          <Link href="/login" className="mt-6 inline-flex w-full justify-center rounded-xl bg-pin-400 px-4 py-3 text-sm font-semibold text-white hover:bg-pin-500">
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
          <p className="mt-2 text-sm text-steel-400">This secure link can be used only once and expires after one hour.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-steel-300">New password</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20"
              />
            </div>
            <div>
              <label htmlFor="confirmation" className="block text-sm font-medium text-steel-300">Confirm password</label>
              <input
                id="confirmation"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm text-white focus:border-pin-400 focus:outline-none focus:ring-2 focus:ring-pin-400/20"
              />
            </div>
            {(validationError || reset.error) && (
              <div className="flex gap-2 rounded-xl border border-pin-400/20 bg-pin-400/10 p-4 text-sm text-pin-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{validationError ?? reset.error?.message}</span>
              </div>
            )}
            <button type="submit" disabled={reset.isPending || !token} className="flex w-full items-center justify-center gap-2 rounded-xl bg-pin-400 px-4 py-3 text-sm font-semibold text-white hover:bg-pin-500 disabled:opacity-50">
              {reset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Update password
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-ink-800/50 p-8">
        <Link href="/"><LogoMark className="mx-auto mb-6 h-10 w-auto" /></Link>
        {children}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell><Loader2 className="mx-auto h-12 w-12 animate-spin text-pin-300" /></AuthShell>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
