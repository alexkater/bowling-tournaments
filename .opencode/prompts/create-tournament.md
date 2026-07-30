# Create Tournament

Implement the full flow for creating a new tournament.

## Steps
1. Add the `createTournament` tRPC procedure in `apps/api/src/routers/tournament.ts`
2. Validate input with `CreateTournamentSchema` from `@bowling/shared`
3. Insert into database using Drizzle
4. Return the created tournament with the generated ID
5. On the web: create the form page with all config fields (dates, handicap, formats, etc.)

## Files
- `apps/api/src/routers/tournament.ts`
- `apps/web/src/app/tournaments/new/page.tsx`
- `packages/db/src/schema/tournament.ts`

## Validation
- `CreateTournamentSchema` from `@bowling/shared`
- Dates must be in the future for startDate
- endDate must be after startDate
