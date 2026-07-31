import { router } from '../trpc'
import { tournamentRouter } from './tournament'
import { squadRouter } from './squad'
import { bracketRouter } from './bracket'
import { sidepotRouter } from './sidepot'
import { authRouter } from './auth'
import { playerRouter } from './player'
import { standingsRouter } from './standings'
import { enrollmentRouter } from './enrollment'

export const appRouter = router({
  auth: authRouter,
  tournament: tournamentRouter,
  squad: squadRouter,
  bracket: bracketRouter,
  sidepot: sidepotRouter,
  player: playerRouter,
  standings: standingsRouter,
  enrollment: enrollmentRouter,
})

export type AppRouter = typeof appRouter
