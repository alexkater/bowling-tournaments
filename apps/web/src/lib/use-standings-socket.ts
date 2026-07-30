'use client'

import { useEffect, useRef, useState } from 'react'

interface WsState {
  connected: boolean
  lastEvent: { event: string; data: unknown; timestamp: string } | null
}

export function useStandingsSocket(squadId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const [state, setState] = useState<WsState>({ connected: false, lastEvent: null })

  useEffect(() => {
    if (!squadId) return

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/trpc'
    const wsUrl = apiUrl.replace(/\/trpc$/, '').replace(/^http/, 'ws')
    const url = `${wsUrl}/ws/standings/${squadId}`

    let closed = false

    function connect() {
      if (closed) return
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        if (!closed) setState((s) => ({ ...s, connected: true }))
      }

      ws.onmessage = (event) => {
        if (closed) return
        try {
          const parsed = JSON.parse(event.data as string)
          setState({ connected: true, lastEvent: parsed })
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        if (closed) return
        setState((s) => ({ ...s, connected: false }))
        setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      closed = true
      wsRef.current?.close()
    }
  }, [squadId])

  return state
}
