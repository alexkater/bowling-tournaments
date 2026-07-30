export type BracketType = 'forward' | 'reverse' | 'eliminator'

// ---- Eight-person bracket matchups ----

/**
 * Genera matchups para bracket forward de 8 personas: (1v8, 2v7, 3v6, 4v5)
 * El orden de players define la seed.
 */
export function forwardMatchups(players: string[]): [string, string][] {
  if (players.length < 2) return []
  const sorted = [...players]
  const matchups: [string, string][] = []
  let i = 0
  let j = sorted.length - 1
  while (i < j) {
    matchups.push([sorted[i]!, sorted[j]!])
    i++
    j--
  }
  return matchups
}

/**
 * Genera matchups para bracket reverse de 8 personas: (1v2, 3v4, 5v6, 7v8)
 */
export function reverseMatchups(players: string[]): [string, string][] {
  if (players.length < 2) return []
  const sorted = [...players]
  const matchups: [string, string][] = []
  for (let i = 0; i < sorted.length - 1; i += 2) {
    matchups.push([sorted[i]!, sorted[i + 1]!])
  }
  return matchups
}

// ---- Single Elimination Tree ----

export interface SETreeNode {
  matchId: string
  player1Id: string | null
  player2Id: string | null
  winnerId: string | null
  child1: SETreeNode | null  // left branch
  child2: SETreeNode | null  // right branch
  nextMatchId: string | null // match en la siguiente ronda
  nextPosition: 'top' | 'bottom' | null
}

/**
 * Genera un árbol de single elimination.
 * Retorna el nodo raíz. Los nodos sin asignar tienen player1Id/player2Id = null.
 */
export function generateSETree(playerCount: number): { root: SETreeNode; rounds: number } {
  // Encontrar la potencia de 2 más cercana hacia arriba
  const rounds = Math.ceil(Math.log2(playerCount))
  const bracketSize = Math.pow(2, rounds)
  let matchCounter = 0
  const nextMatchId = (): string => `m_${matchCounter++}`

  function buildRound(_round: number, count: number): SETreeNode[] {
    const nodes: SETreeNode[] = []
    for (let i = 0; i < count; i++) {
      nodes.push({
        matchId: nextMatchId(),
        player1Id: null,
        player2Id: null,
        winnerId: null,
        child1: null,
        child2: null,
        nextMatchId: null,
        nextPosition: null,
      })
    }
    return nodes
  }

  // Primera ronda: N matches para N*2 jugadores
  let currentRound = buildRound(1, bracketSize / 2)

  // Asignar byes: los primeros 'byes' matches tienen un hueco
  // En SE, los byes (players fantasma) avanzan automáticamente
  // Los primeros 'byes' matches tienen un player que avanza automáticamente

  // Generar rondas superiores
  const allRounds: SETreeNode[][] = [currentRound]
  let matchCount = currentRound.length

  while (matchCount > 1) {
    const nextCount = Math.ceil(matchCount / 2)
    const nextRound = buildRound(allRounds.length + 1, nextCount)

    // Conectar cada match de la ronda actual con el de arriba
    for (let i = 0; i < currentRound.length; i++) {
      const parentMatchIdx = Math.floor(i / 2)
      const parentMatch = nextRound[parentMatchIdx]
      if (parentMatch) {
        currentRound[i]!.nextMatchId = parentMatch.matchId
        currentRound[i]!.nextPosition = i % 2 === 0 ? 'top' : 'bottom'
      }
    }

    allRounds.push(nextRound)
    currentRound = nextRound
    matchCount = nextCount
  }

  return { root: currentRound[0]!, rounds }
}

// ---- Bracket Pool Shuffle ----

/**
 * Evalúa el score de fairness de un shuffle: cuántos pares de jugadores
 * se repiten en diferentes brackets. Menor score = más justo.
 */
export function evaluateShuffle(matchups: [string, string][], history: string[][]): number {
  let score = 0
  const pairCount = new Map<string, number>()

  for (const [a, b] of matchups) {
    const key1 = `${a}:${b}`
    const key2 = `${b}:${a}`
    const existing = pairCount.get(key1) ?? pairCount.get(key2) ?? 0
    score += existing
    pairCount.set(key1, (pairCount.get(key1) ?? 0) + 1)
  }

  // Penalizar pares que ya aparecieron en history
  for (const bracket of history) {
    for (let i = 0; i < bracket.length; i++) {
      for (let j = i + 1; j < bracket.length; j++) {
        const key = `${bracket[i]}:${bracket[j]}`
        if (pairCount.has(key)) {
          score += 50 // penalización alta por repetir en brackets anteriores
        }
      }
    }
  }

  return score
}

/**
 * Fisher-Yates shuffle.
 */
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

/**
 * Encuentra el shuffle más justo usando N iteraciones.
 * Minimiza la repetición de pares entre brackets y dentro del mismo bracket.
 */
export function fairnessShuffle(
  players: string[],
  bracketType: BracketType,
  iterations = 50000,
  history: string[][] = [],
): string[] {
  if (players.length <= 2) return players

  let bestShuffle: string[] | null = null
  let bestScore = Infinity
  const matchupFn = bracketType === 'reverse' ? reverseMatchups : forwardMatchups

  for (let i = 0; i < iterations; i++) {
    const shuffled = shuffleArray(players)
    const matchups = matchupFn(shuffled)
    const score = evaluateShuffle(matchups, history)

    if (score < bestScore) {
      bestScore = score
      bestShuffle = shuffled
    }

    // Si encontramos un shuffle perfecto, parar antes
    if (bestScore === 0) break
  }

  return bestShuffle ?? players
}

// ---- Advancing Rounds ----

/**
 * Determina ganadores de un bracket forward/reverse dado un mapa de scores.
 * Cada matchup: gana el que tiene mayor score.
 */
export function advanceHeadToHead(
  matchups: [string, string][],
  scores: Map<string, number>,
): string[] {
  return matchups.map(([a, b]) => {
    const scoreA = scores.get(a) ?? 0
    const scoreB = scores.get(b) ?? 0
    return scoreA >= scoreB ? a : b
  })
}

/**
 * Para eliminator bracket: top N scores avanzan.
 */
export function advanceEliminator(
  players: string[],
  scores: Map<string, number>,
  advanceCount: number,
): string[] {
  const withScores = players
    .map((p) => ({ id: p, score: scores.get(p) ?? 0 }))
    .sort((a, b) => b.score - a.score)

  return withScores.slice(0, advanceCount).map((p) => p.id)
}

/**
 * Construye los brackets de siguiente ronda a partir de los ganadores.
 */
export function buildNextRound(
  winners: string[],
  bracketType: BracketType,
): [string, string][] {
  if (bracketType === 'eliminator') {
    // En eliminator no hay matchups head-to-head
    return []
  }
  return bracketType === 'forward' ? forwardMatchups(winners) : reverseMatchups(winners)
}
