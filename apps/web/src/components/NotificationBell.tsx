'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Bell, X } from 'lucide-react'
import { trpc } from '@/lib/trpc-provider'
import Link from 'next/link'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: Date | string
  metadata: Record<string, unknown> | null
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const utils = trpc.useUtils()

  // Check if logged in
  const { data: me } = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 60_000 })
  const isLoggedIn = !!me

  const { data: count } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
    enabled: isLoggedIn,
  })

  const { data: items, isLoading } = trpc.notification.list.useQuery(
    { limit: 20 },
    { enabled: open }
  )

  const markRead = trpc.notification.markRead.useMutation({
    onSuccess: () => utils.notification.invalidate(),
  })

  const markAllRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => utils.notification.invalidate(),
  })

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  const handleMarkRead = useCallback((id: string) => {
    markRead.mutate({ id })
  }, [markRead])

  const timeAgo = (date: Date | string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case 'enrollment_confirmed': return '✅'
      case 'waitlisted': return '⏳'
      case 'tournament_reminder': return '⏰'
      case 'results_posted': return '🏆'
      default: return '📢'
    }
  }

  if (!isLoggedIn) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-steel-400 hover:text-white transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {count && count > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-pin-400 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-ink-800 shadow-2xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="font-semibold text-white text-sm">Notificaciones</h3>
            {count && count > 0 ? (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-pin-400 hover:text-pin-300"
              >
                Marcar todas leídas
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-steel-500 text-sm">Cargando...</div>
            ) : !items?.length ? (
              <div className="p-6 text-center text-steel-500 text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No hay notificaciones
              </div>
            ) : (
              items.map((n: NotificationItem) => (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${!n.read ? 'bg-pin-400/5' : ''}`}
                  onClick={() => handleMarkRead(n.id)}
                >
                  <span className="text-lg mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'text-white font-medium' : 'text-steel-300'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-steel-500 mt-0.5 truncate">{n.body}</p>
                    <p className="text-[10px] text-steel-600 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="h-2 w-2 rounded-full bg-pin-400 mt-2 shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
