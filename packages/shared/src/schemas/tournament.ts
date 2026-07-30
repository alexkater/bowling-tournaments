import { z } from 'zod'

export const RegisterPlayerSchema = z.object({
  tournamentId: z.string().uuid(),
  squadId: z.string().uuid(),
  eventEntries: z.array(z.object({
    eventType: z.enum(['singles', 'doubles', 'trios', 'teams', 'all_events']),
    partners: z.array(z.string().uuid()).default([]),
  })),
})
