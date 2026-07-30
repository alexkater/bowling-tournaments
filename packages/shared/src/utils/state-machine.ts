export type TournamentStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled'
export type BracketStatus = 'open' | 'shuffling' | 'in_progress' | 'completed' | 'cancelled'

type StatusMap = {
  tournament: TournamentStatus
  bracket: BracketStatus
}

type AnyStatus = TournamentStatus | BracketStatus

const TOURNAMENT_TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ['published', 'cancelled'],
  published: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

const BRACKET_TRANSITIONS: Record<BracketStatus, BracketStatus[]> = {
  open: ['shuffling', 'cancelled'],
  shuffling: ['in_progress'],
  in_progress: ['completed'],
  completed: [],
  cancelled: [],
}

function getTransitions(type: keyof StatusMap): Record<string, AnyStatus[]> {
  return type === 'tournament' ? TOURNAMENT_TRANSITIONS : BRACKET_TRANSITIONS
}

export function transition<T extends keyof StatusMap>(
  type: T,
  current: StatusMap[T],
  target: StatusMap[T],
): StatusMap[T] {
  const transitions = getTransitions(type)
  const allowed = transitions[current] as StatusMap[T][] | undefined

  if (!allowed) {
    throw new Error(`Unknown status: ${current}`)
  }

  if (!allowed.includes(target)) {
    throw new Error(
      `Invalid transition: ${current} → ${target}. ` +
      `Allowed: ${allowed.join(', ') || 'none'}`,
    )
  }

  return target
}

export function getValidTransitions<T extends keyof StatusMap>(
  type: T,
  current: StatusMap[T],
): StatusMap[T][] {
  const transitions = getTransitions(type)
  return (transitions[current] ?? []) as StatusMap[T][]
}
