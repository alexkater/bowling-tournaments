'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { LogoMark } from '@/components/Logo'
import { trpc } from '@/lib/trpc-provider'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const searchToken = searchParams.get('token')
  const [token, setToken] = useState<string | null>(null)
  const [tokenResolved, setTokenResolved] = useState(false)
  const started = useRef(false)
  const verification = trpc.auth.verifyEmail.useMutation()

  useEffect(() => {
    const currentUrl = new URL(window.location.href)
    const fragmentToken = new URLSearchParams(currentUrl.hash.slice(1)).get('token')
    const resolvedToken = fragmentToken ?? searchToken
    setToken(resolvedToken)
    setTokenResolved(true)

    if (resolvedToken) {
      currentUrl.hash = ''
      currentUrl.searchParams.delete('token')
      window.history.replaceState(window.history.state, '', `${currentUrl.pathname}${currentUrl.search}`)
    }
  }, [searchToken])

  useEffect(() => {
    if (token && !started.current) {
      started.current = true
      verification.mutate({ token })
    }
  }, [token, verification])

  return (
    <AuthShell>
      {!tokenResolved ? (
        <>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-pin-300" />
          <h1 className="mt-4 text-2xl font-bold text-white">Reading secure link</h1>
        </>
      ) : !token || verification.isError ? (
        <>
          <AlertCircle className="mx-auto h-12 w-12 text-pin-300" />
          <h1 className="mt-4 text-2xl font-bold text-white">Verification link unavailable</h1>
          <p className="mt-2 text-sm text-steel-400">
            {verification.error?.message ?? 'This link is missing its secure token.'}
          </p>
          <Link href="/signup" className="mt-6 inline-block text-sm font-semibold text-pin-300 hover:text-pin-200">
            Return to sign up
          </Link>
        </>
      ) : verification.isSuccess ? (
        <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-4 text-2xl font-bold text-white">Email verified</h1>
          <p className="mt-2 text-sm text-steel-400">Your account is ready. Sign in to continue.</p>
          <Link href="/login" className="mt-6 inline-flex w-full justify-center rounded-xl bg-pin-400 px-4 py-3 text-sm font-semibold text-white hover:bg-pin-500">
            Sign in
          </Link>
        </>
      ) : (
        <>
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-pin-300" />
          <h1 className="mt-4 text-2xl font-bold text-white">Verifying your email</h1>
          <p className="mt-2 text-sm text-steel-400">Please keep this page open for a moment.</p>
        </>
      )}
    </AuthShell>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/5 bg-ink-800/50 p-8 text-center">
        <Link href="/"><LogoMark className="mx-auto mb-6 h-10 w-auto" /></Link>
        {children}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthShell><Loader2 className="mx-auto h-12 w-12 animate-spin text-pin-300" /></AuthShell>}>
      <VerifyEmailContent />
    </Suspense>
  )
}
