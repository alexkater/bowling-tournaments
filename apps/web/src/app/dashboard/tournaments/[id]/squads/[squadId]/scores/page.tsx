'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { trpc } from '@/lib/trpc-provider'
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

interface ScoreCell {
  id: string
  rawScore: number
  handicapScore: number | null
  pins: number[]
}

interface ScoreRow {
  player: {
    id: string
    profileId: string
    lane: number | null
    checkedIn: boolean
    firstName: string | null
    lastName: string | null
  }
  games: (ScoreCell | null)[]
}

interface ScoreSheetData {
  squad: {
    id: string
    name: string
    stageId: string
    date: string
    startTime: string
    laneStart: number | null
    laneEnd: number | null
    maxPlayers: number | null
    sortOrder: number
  }
  gameNumbers: number[]
  rows: ScoreRow[]
}

// ─── Helpers ────────────────────────────────────────────────────────

function computeTotalRaw(games: (ScoreCell | null)[]): number {
  return games.reduce((sum, g) => sum + (g?.rawScore ?? 0), 0)
}

function computeTotalHandicap(games: (ScoreCell | null)[]): number {
  return games.reduce((sum, g) => sum + (g?.handicapScore ?? g?.rawScore ?? 0), 0)
}

function formatScore(value: number | null | undefined): string {
  return value != null ? String(value) : '—'
}

// ─── Component ──────────────────────────────────────────────────────

export default function ScoreEntryPage() {
  const params = useParams()
  const squadId = params.squadId as string
  const tournamentId = params.id as string

  const { data, isLoading, error } = trpc.squad.getScoreSheet.useQuery(squadId)
  const utils = trpc.useUtils()
  const enterScoreMutation = trpc.squad.enterScore.useMutation({
    onSuccess: () => {
      utils.squad.getScoreSheet.invalidate(squadId)
    },
  })

  const scoreSheet = data as ScoreSheetData | undefined

  // Track which cells are currently saving
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set())
  // Track which cells have errors
  const [cellErrors, setCellErrors] = useState<Map<string, string>>(new Map())
  // Track input values locally for responsive editing
  const [inputValues, setInputValues] = useState<Map<string, string>>(new Map())
  // Track if a cell is being edited
  const [editingCell, setEditingCell] = useState<string | null>(null)

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // Reset input values when data loads
  useEffect(() => {
    if (scoreSheet) {
      setInputValues(new Map())
    }
  }, [scoreSheet])

  const getCellKey = useCallback(
    (playerId: string, gameNumber: number) => `${playerId}:${gameNumber}`,
    [],
  )

  const handleCellFocus = useCallback(
    (playerId: string, gameNumber: number, currentScore: number | null) => {
      const key = getCellKey(playerId, gameNumber)
      setEditingCell(key)
      setInputValues((prev) => {
        const next = new Map(prev)
        next.set(key, currentScore != null ? String(currentScore) : '')
        return next
      })
      setCellErrors((prev) => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
    },
    [getCellKey],
  )

  const handleCellChange = useCallback(
    (playerId: string, gameNumber: number, value: string) => {
      const key = getCellKey(playerId, gameNumber)
      setInputValues((prev) => {
        const next = new Map(prev)
        next.set(key, value)
        return next
      })
      // Clear error on change
      setCellErrors((prev) => {
        const next = new Map(prev)
        next.delete(key)
        return next
      })
    },
    [getCellKey],
  )

  const handleCellBlur = useCallback(
    (playerId: string, gameNumber: number) => {
      const key = getCellKey(playerId, gameNumber)
      setEditingCell(null)

      const rawValue = inputValues.get(key)
      if (rawValue == null || rawValue === '') return

      const parsed = parseInt(rawValue, 10)
      if (isNaN(parsed) || parsed < 0 || parsed > 300) {
        setCellErrors((prev) => {
          const next = new Map(prev)
          next.set(key, 'Score must be 0–300')
          return next
        })
        return
      }

      // Don't save if the value hasn't changed
      const cell = scoreSheet?.rows
        .find((r) => r.player.id === playerId)
        ?.games[gameNumber - 1]
      if (cell?.rawScore === parsed) {
        setInputValues((prev) => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
        return
      }

      setSavingCells((prev) => {
        const next = new Set(prev)
        next.add(key)
        return next
      })

      enterScoreMutation.mutate(
        { tournamentPlayerId: playerId, gameNumber, rawScore: parsed },
        {
          onSettled: () => {
            setSavingCells((prev) => {
              const next = new Set(prev)
              next.delete(key)
              return next
            })
            setInputValues((prev) => {
              const next = new Map(prev)
              next.delete(key)
              return next
            })
          },
          onError: (err) => {
            setCellErrors((prev) => {
              const next = new Map(prev)
              next.set(key, err.message)
              return next
            })
          },
        },
      )
    },
    [getCellKey, inputValues, scoreSheet, enterScoreMutation],
  )

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent, playerId: string, gameNumber: number) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        ;(e.target as HTMLInputElement).blur()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        const key = getCellKey(playerId, gameNumber)
        setEditingCell(null)
        setInputValues((prev) => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
      }
    },
    [getCellKey],
  )

  // ─── Loading state ──────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="h-4 w-48 rounded bg-gray-100" />
        <div className="mt-8 h-96 rounded-lg bg-gray-100" />
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────

  if (error || !scoreSheet) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
        <p className="mt-3 text-sm text-red-600">
          {error?.message === 'NOT_FOUND' ? 'Squad not found.' : 'Failed to load score sheet.'}
        </p>
        <Link
          href={`/dashboard/tournaments/${tournamentId}`}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tournament
        </Link>
      </div>
    )
  }

  const { squad, gameNumbers, rows } = scoreSheet

  // ─── Empty state ────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <div>
        <Link
          href={`/dashboard/tournaments/${tournamentId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tournament
        </Link>

        <div className="mt-12 rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Save className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No players in this squad</h3>
          <p className="mt-2 text-sm text-gray-500">
            Add players to the squad before entering scores.
          </p>
          <Link
            href={`/dashboard/tournaments/${tournamentId}`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Back to tournament
          </Link>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/dashboard/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Tournament
      </Link>

      {/* Header */}
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{squad.name} — Score Entry</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} player{rows.length !== 1 ? 's' : ''} · {gameNumbers.length} game{gameNumbers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Score grid */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          {/* Header */}
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Player
              </th>
              {gameNumbers.map((gn) => (
                <th
                  key={gn}
                  className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  Game {gn}
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Raw Total
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                HCP Total
              </th>
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const totalRaw = computeTotalRaw(row.games)
              const totalHandicap = computeTotalHandicap(row.games)

              return (
                <tr key={row.player.id} className="hover:bg-gray-50/50 transition-colors">
                  {/* Player name */}
                  <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[160px]">
                        {row.player.firstName ?? 'Player'} {row.player.lastName ?? ''}{row.player.lane ? ` (Lane ${row.player.lane})` : ''}
                      </span>
                    </div>
                  </td>

                  {/* Game score cells */}
                  {gameNumbers.map((gn) => {
                    const cell = row.games[gn - 1]
                    const key = getCellKey(row.player.id, gn)
                    const isSaving = savingCells.has(key)
                    const isEditing = editingCell === key
                    const error = cellErrors.get(key)
                    const inputValue = inputValues.get(key)

                    return (
                      <td key={gn} className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center">
                          {isEditing ? (
                            <input
                              ref={(el) => {
                                if (el) inputRefs.current.set(key, el)
                                else inputRefs.current.delete(key)
                              }}
                              type="number"
                              min={0}
                              max={300}
                              value={inputValue ?? ''}
                              onChange={(e) =>
                                handleCellChange(row.player.id, gn, e.target.value)
                              }
                              onBlur={() => handleCellBlur(row.player.id, gn)}
                              onKeyDown={(e) => handleCellKeyDown(e, row.player.id, gn)}
                              autoFocus
                              className={`w-16 rounded border px-2 py-1 text-center text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                error
                                  ? 'border-red-300 bg-red-50'
                                  : 'border-blue-300 bg-blue-50'
                              }`}
                            />
                          ) : (
                            <button
                              onClick={() =>
                                handleCellFocus(
                                  row.player.id,
                                  gn,
                                  cell?.rawScore ?? null,
                                )
                              }
                              disabled={isSaving}
                              className={`w-16 rounded px-2 py-1 text-center text-sm font-medium tabular-nums transition-colors hover:bg-gray-100 ${
                                cell?.rawScore != null
                                  ? 'text-gray-900'
                                  : 'text-gray-300'
                              } ${isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                            >
                              {isSaving ? (
                                <Loader2 className="mx-auto h-4 w-4 animate-spin text-blue-500" />
                              ) : (
                                formatScore(cell?.rawScore)
                              )}
                            </button>
                          )}
                          {error && (
                            <span className="mt-0.5 text-[10px] text-red-500 whitespace-nowrap">
                              {error}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}

                  {/* Raw total */}
                  <td className="px-3 py-3 text-center text-sm font-semibold text-gray-900 tabular-nums">
                    {totalRaw}
                  </td>

                  {/* Handicap total */}
                  <td className="px-3 py-3 text-center text-sm font-semibold text-blue-600 tabular-nums">
                    {totalHandicap}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span>Click a score cell to edit</span>
        <span>·</span>
        <span>Enter to save</span>
        <span>·</span>
        <span>Esc to cancel</span>
        <span>·</span>
        <span>Valid range: 0–300</span>
      </div>
    </div>
  )
}
