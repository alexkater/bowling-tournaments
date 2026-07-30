import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const queryClient = postgres(process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling')
const db = drizzle(queryClient, { schema })

async function seed() {
  console.log('Seeding database...')

  // Organization
  const [org] = await db.insert(schema.organizations).values({
    name: 'Strike Zone Bowling Center',
    slug: 'strike-zone',
  }).returning()
  if (!org) throw new Error('Failed to create seed organization')
  console.log('Organization:', org.id)

  // Profiles (players & organizer)
  const [organizer] = await db.insert(schema.profiles).values({
    id: crypto.randomUUID(),
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@strikezone.com',
    role: 'organizer',
  }).returning()

  const [player1] = await db.insert(schema.profiles).values({
    id: crypto.randomUUID(),
    firstName: 'Alice',
    lastName: 'Smith',
    email: 'alice@example.com',
    average: 185,
  }).returning()

  const [player2] = await db.insert(schema.profiles).values({
    id: crypto.randomUUID(),
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob@example.com',
    average: 172,
  }).returning()

  const [player3] = await db.insert(schema.profiles).values({
    id: crypto.randomUUID(),
    firstName: 'Carol',
    lastName: 'Williams',
    email: 'carol@example.com',
    average: 195,
  }).returning()

  const [player4] = await db.insert(schema.profiles).values({
    id: crypto.randomUUID(),
    firstName: 'Dave',
    lastName: 'Brown',
    email: 'dave@example.com',
    average: 160,
  }).returning()

  if (!organizer || !player1 || !player2 || !player3 || !player4) {
    throw new Error('Failed to create seed profiles')
  }

  // Add organizer as member
  await db.insert(schema.organizationMembers).values({
    organizationId: org.id,
    profileId: organizer.id,
    role: 'owner',
  })

  // Tournament — 2-stage: Qualifying → Stepladder Finals
  const [tournament] = await db.insert(schema.tournaments).values({
    organizationId: org.id,
    name: 'Summer Classic 2026',
    description: 'Annual summer tournament at Strike Zone',
    status: 'published',
    category: 'open',
    startDate: new Date('2026-08-15'),
    endDate: new Date('2026-08-16'),
    registrationDeadline: new Date('2026-08-10'),
  }).returning()
  if (!tournament) throw new Error('Failed to create seed tournament')

  // Stage 1: Qualifying (total pins, 6 games, top 16 advance)
  const [stage1] = await db.insert(schema.stages).values({
    tournamentId: tournament.id,
    name: 'Qualifying',
    sortOrder: 0,
    format: {
      type: 'total_pins',
      gamesPerPlayer: 6,
      eventType: 'singles',
      scoring: { type: 'handicap', handicapBase: 220, handicapPercentage: 80, handicapMax: null, noTap: false },
    },
    advancement: {
      type: 'cut_line',
      advanceCount: 16,
      tiebreaker: 'highest_game',
      label: 'Top 16',
    },
    standingsScope: 'combined',
  }).returning()
  if (!stage1) throw new Error('Failed to create qualifying stage')

  // Stage 2: Stepladder Finals (top 4)
  const [stage2] = await db.insert(schema.stages).values({
    tournamentId: tournament.id,
    name: 'Stepladder Finals',
    sortOrder: 1,
    format: {
      type: 'stepladder',
      positions: 4,
      matchLength: 1,
      scoring: { type: 'scratch', handicapBase: 220, handicapPercentage: 80, handicapMax: null, noTap: false },
    },
    advancement: { type: 'final' },
  }).returning()
  if (!stage2) throw new Error('Failed to create final stage')

  // Squad for stage 1
  const [squad] = await db.insert(schema.squads).values({
    stageId: stage1.id,
    name: 'Squad A - Saturday Morning',
    date: new Date('2026-08-15'),
    startTime: '09:00',
    laneStart: 1,
    laneEnd: 8,
    maxPlayers: 32,
  }).returning()
  if (!squad) throw new Error('Failed to create seed squad')

  // Register players
  for (const player of [player1, player2, player3, player4]) {
    await db.insert(schema.tournamentPlayers).values({
      tournamentId: tournament.id,
      profileId: player.id,
      squadId: squad.id,
      lane: null,
      eventEntries: [{ eventType: 'singles', partners: [] }],
    })
  }

  console.log('Tournament:', tournament.id)
  console.log('Stages: Qualifying (id=' + stage1.id + '), Stepladder Finals (id=' + stage2.id + ')')
  console.log('Squad:', squad.id)
  console.log('Players registered:', 4)
  console.log('Seed complete!')
}

seed().catch(console.error).finally(() => process.exit(0))
