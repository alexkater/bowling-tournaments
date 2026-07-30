export type Pinfall = number // 0-10 per roll, or 0-300 per game

export interface Frame {
  rolls: Pinfall[]
  frameScore: number | null
  isStrike: boolean
  isSpare: boolean
  isSplit: boolean | null
}

export interface Game {
  id: string
  tournamentPlayerId: string
  gameNumber: number
  frames: Frame[]
  rawScore: number
  handicapScore: number | null
  pins: Pinfall[]
}

export interface StandingsEntry {
  rank: number
  playerId: string
  playerName: string
  totalRaw: number
  totalHandicap: number
  games: Game[]
  behind: number
  isCut: boolean
}

export interface EventResults {
  eventType: import('./stage').EventType
  standings: StandingsEntry[]
}
