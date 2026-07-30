import type { WebSocket } from 'ws'

interface Connection {
  ws: WebSocket
  squadId: string
  alive: boolean
}

class WsManager {
  private connections = new Map<string, Set<Connection>>()

  add(squadId: string, ws: WebSocket): void {
    let set = this.connections.get(squadId)
    if (!set) {
      set = new Set()
      this.connections.set(squadId, set)
    }

    const conn: Connection = { ws, squadId, alive: true }

    ws.on('pong', () => {
      conn.alive = true
    })

    ws.on('close', () => {
      set?.delete(conn)
      if (set?.size === 0) {
        this.connections.delete(squadId)
      }
    })

    ws.on('error', () => {
      set?.delete(conn)
      if (set?.size === 0) {
        this.connections.delete(squadId)
      }
    })

    set.add(conn)
  }

  broadcast(squadId: string, event: string, data: unknown): void {
    const set = this.connections.get(squadId)
    if (!set) return

    const payload = JSON.stringify({ event, data, squadId, timestamp: new Date().toISOString() })
    for (const conn of set) {
      if (conn.ws.readyState === conn.ws.OPEN) {
        conn.ws.send(payload)
      }
    }
  }

  startHeartbeat(intervalMs = 30_000): NodeJS.Timeout {
    return setInterval(() => {
      for (const [, set] of this.connections) {
        for (const conn of set) {
          if (!conn.alive) {
            conn.ws.terminate()
            set.delete(conn)
          } else {
            conn.alive = false
            conn.ws.ping()
          }
        }
        if (set.size === 0) {
          this.connections.delete([...this.connections.entries()].find(([, s]) => s === set)?.[0] ?? '')
        }
      }
    }, intervalMs)
  }

  getConnectionCount(squadId?: string): number {
    if (squadId) {
      return this.connections.get(squadId)?.size ?? 0
    }
    let total = 0
    for (const set of this.connections.values()) {
      total += set.size
    }
    return total
  }
}

export const wsManager = new WsManager()
