import type { TournamentStatus } from '../utils/state-machine'
export type { TournamentStatus }

export type TournamentCategory = 'open' | 'women' | 'senior' | 'youth' | 'mixed'

export type SquadStatus = 'pending' | 'active' | 'completed'

export interface Tournament {
  id: string
  name: string
  description: string | null
  organizationId: string
  centerId: string
  status: TournamentStatus
  category: TournamentCategory
  maxPlayers: number | null
  allowWaitlist: boolean
  startDate: string
  endDate: string
  registrationDeadline: string | null
  createdAt: string
  updatedAt: string
}

export interface Squad {
  id: string
  stageId: string
  name: string
  date: string
  startTime: string
  status: SquadStatus
  laneRange: [number, number] | null
  maxPlayers: number | null
}
