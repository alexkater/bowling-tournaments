// ============================================================
// Bracket Pools — sidepots opcionales dentro de un torneo
// ============================================================

import type { BracketStatus } from '../utils/state-machine'

export type BracketPoolType =
  | 'eight_person_forward'    // 8 players, 1v8 2v7 3v6 4v5
  | 'eight_person_reverse'    // 8 players, 1v2 3v4 5v6 7v8
  | 'eight_person_eliminator' // 8 players, top scores advance each round
  | 'single_elimination'      // tree bracket (4-64 players)
  | 'double_elimination'      // winners + losers bracket (4-64 players)

export type { BracketStatus } from '../utils/state-machine'

export interface BracketPool {
  id: string
  tournamentId: string
  name: string
  type: BracketPoolType
  entryFee: number
  maxPlayers: number
  currentPlayers: number
  status: BracketStatus
  rounds: BracketRound[]
}

// ============================================================
// Bracket Rounds & Matches
// ============================================================

export interface BracketRound {
  roundNumber: number
  matches: BracketMatch[]
  completed: boolean
}

// Head-to-head match (forward, reverse, single/double elimination)
export interface HeadToHeadMatch {
  kind: 'head_to_head'
  id: string
  roundNumber: number
  position: number
  player1Id: string | null
  player2Id: string | null
  player1Score: number | null
  player2Score: number | null
  winnerId: string | null
  nextMatchId: string | null
  nextMatchPosition: 'top' | 'bottom' | null
}

// Eliminator bracket: N players bowl, top X advance
export interface EliminatorSlot {
  playerId: string
  score: number | null
  rank: number | null
  advanced: boolean
}

export interface EliminatorMatch {
  kind: 'eliminator'
  id: string
  roundNumber: number
  slots: EliminatorSlot[]
  cutLine: number      // cuántos avanzan (ej: top 4)
  completed: boolean
}

export type BracketMatch = HeadToHeadMatch | EliminatorMatch

// ============================================================
// Sidepots
// ============================================================

export type SidepotType =
  | 'high_game'
  | 'high_series'
  | 'mystery_doubles'
  | 'sweeper_doubles'
  | 'big_dog'
  | 'blind_draw'
  | 'eliminator'

export interface Sidepot {
  id: string
  tournamentId: string
  name: string
  type: SidepotType
  entryFee: number
  handicap: boolean
  maxEntries: number | null
  payoutRatio: number
  status: 'open' | 'closed' | 'paid'
}
