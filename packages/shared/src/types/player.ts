export type Gender = 'male' | 'female' | 'other'

export interface Player {
  id: string
  usbcId: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  gender: Gender | null
  birthYear: number | null
  average: number | null
  handicap: number | null
  createdAt: string
}

export interface TournamentPlayer {
  id: string
  tournamentId: string
  playerId: string
  squadId: string
  teamId: string | null
  eventEntries: EventEntry[]
  checkedIn: boolean
  lane: number | null
  createdAt: string
}

export interface EventEntry {
  eventType: import('./stage').EventType
  partners: string[] // player IDs for doubles/trios/teams
}
