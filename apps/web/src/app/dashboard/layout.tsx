'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc-provider'
import { Loader2, LogOut, Trophy, LayoutDashboard, Menu, X } from 'lucide-react'
import { LogoMark } from '@/components/Logo'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/tournaments', label: 'Tournaments', icon: Trophy },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { data: profile, isLoading, error } = trpc.auth.me.useQuery(undefined, { retry: false })

  if (!isLoading && (error?.data?.code === 'UNAUTHORIZED' || (!isLoading && !profile))) {
    router.push('/login')
    return null
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-pin-400" />
          <p className="text-sm text-steel-500">Loading...</p>
        </div>
      </div>
    )
  }

  const displayName = profile ? `${profile.firstName} ${profile.lastName}` : 'Organizer'

  return (
    <div className="flex min-h-screen bg-ink-900">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-white/5 bg-ink-800 transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center justify-between border-b border-white/5 px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark className="h-7 w-auto" />
            <span className="text-lg font-bold text-white">Strike Manager</span>
          </Link>
          <button className="text-steel-500 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-pin-400/10 text-pin-400'
                    : 'text-steel-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1">
        <header className="flex h-16 items-center border-b border-white/5 bg-ink-800/50 px-6 backdrop-blur">
          <button className="mr-4 rounded-lg p-2 text-steel-400 hover:bg-white/5 hover:text-white lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-steel-400">{displayName}</span>
            <button
              onClick={() => { localStorage.removeItem('auth_token'); router.push('/login') }}
              className="rounded-lg p-2 text-steel-500 hover:bg-white/5 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
