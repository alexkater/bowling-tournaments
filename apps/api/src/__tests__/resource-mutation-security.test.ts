import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import * as schema from '@bowling/db';
import { appRouter } from '../routers';

const queryClient = postgres(
  process.env.DATABASE_URL ?? 'postgres://bowling:bowling@localhost:5432/bowling',
  { onnotice: () => {} },
);
const db = drizzle(queryClient, { schema });

function caller(userId: string | null, orgId: string | null) {
  return appRouter.createCaller({
    db,
    userId,
    orgId,
    ip: '198.51.100.40',
    req: {} as never,
    res: {} as never,
  });
}

type MembershipRole = 'owner' | 'admin' | 'scorer' | 'member';

type Resources = {
  tournamentId: string;
  stageId: string;
  squadId: string;
  tournamentPlayer1Id: string;
  tournamentPlayer2Id: string;
  openPoolId: string;
  readyPoolId: string;
  progressMatchId: string;
  advancePoolId: string;
  sidepotId: string;
};

async function seedOrganization(
  suffix: string,
  member?: { profileId: string; role: MembershipRole },
) {
  if (member) {
    await db.insert(schema.profiles).values({
      id: member.profileId,
      firstName: 'Operator',
      lastName: suffix,
      email: `${member.profileId}@example.com`,
      role: 'organizer',
    });
  }

  const [organization] = await db
    .insert(schema.organizations)
    .values({
      name: `Organization ${suffix}`,
      slug: `organization-${suffix}-${crypto.randomUUID()}`,
    })
    .returning();
  if (!organization) throw new Error('Failed to seed organization');

  if (member) {
    await db.insert(schema.organizationMembers).values({
      organizationId: organization.id,
      profileId: member.profileId,
      role: member.role,
    });
  }

  return organization;
}

async function seedResources(organizationId: string, suffix: string): Promise<Resources> {
  const [tournament] = await db
    .insert(schema.tournaments)
    .values({
      organizationId,
      name: `Tournament ${suffix}`,
      status: 'in_progress',
      startDate: new Date('2026-08-01T00:00:00Z'),
      endDate: new Date('2026-08-03T00:00:00Z'),
    })
    .returning();
  if (!tournament) throw new Error('Failed to seed tournament');

  const [stage] = await db
    .insert(schema.stages)
    .values({
      tournamentId: tournament.id,
      name: 'Qualifying',
      sortOrder: 0,
      format: {
        type: 'total_pins',
        gamesPerPlayer: 3,
        eventType: 'singles',
        scoring: { type: 'scratch', noTap: false },
      },
      advancement: { type: 'final' },
    })
    .returning();
  if (!stage) throw new Error('Failed to seed stage');

  const [squad] = await db
    .insert(schema.squads)
    .values({
      stageId: stage.id,
      name: 'Squad A',
      date: new Date('2026-08-01T09:00:00Z'),
      startTime: '09:00',
    })
    .returning();
  if (!squad) throw new Error('Failed to seed squad');

  const playerProfiles = await db
    .insert(schema.profiles)
    .values([
      {
        id: `authz-player-1-${suffix}`,
        firstName: 'Player',
        lastName: 'One',
        email: `player-1-${suffix}@example.com`,
        role: 'player',
        average: 180,
      },
      {
        id: `authz-player-2-${suffix}`,
        firstName: 'Player',
        lastName: 'Two',
        email: `player-2-${suffix}@example.com`,
        role: 'player',
        average: 190,
      },
    ])
    .returning();

  const tournamentPlayers = await db
    .insert(schema.tournamentPlayers)
    .values(
      playerProfiles.map((profile) => ({
        tournamentId: tournament.id,
        profileId: profile.id,
        squadId: squad.id,
      })),
    )
    .returning();
  const [tp1, tp2] = tournamentPlayers;
  if (!tp1 || !tp2) throw new Error('Failed to seed tournament players');

  const [openPool, readyPool, progressPool, advancePool] = await db
    .insert(schema.bracketPools)
    .values([
      { tournamentId: tournament.id, name: 'Open Pool', type: 'eight_person_forward' },
      { tournamentId: tournament.id, name: 'Ready Pool', type: 'eight_person_forward' },
      {
        tournamentId: tournament.id,
        name: 'Progress Pool',
        type: 'eight_person_forward',
        status: 'in_progress',
      },
      {
        tournamentId: tournament.id,
        name: 'Advance Pool',
        type: 'eight_person_forward',
        status: 'in_progress',
      },
    ])
    .returning();
  if (!openPool || !readyPool || !progressPool || !advancePool) {
    throw new Error('Failed to seed bracket pools');
  }

  await db.insert(schema.bracketEntries).values([
    { bracketPoolId: readyPool.id, tournamentPlayerId: tp1.id, entryNumber: 1 },
    { bracketPoolId: readyPool.id, tournamentPlayerId: tp2.id, entryNumber: 1 },
  ]);

  const [progressRound, advanceRound] = await db
    .insert(schema.bracketRounds)
    .values([
      { bracketPoolId: progressPool.id, roundNumber: 1 },
      { bracketPoolId: advancePool.id, roundNumber: 1 },
    ])
    .returning();
  if (!progressRound || !advanceRound) throw new Error('Failed to seed bracket rounds');

  const [progressMatch] = await db
    .insert(schema.bracketMatches)
    .values({
      roundId: progressRound.id,
      position: 1,
      player1Id: tp1.id,
      player2Id: tp2.id,
    })
    .returning();
  if (!progressMatch) throw new Error('Failed to seed bracket match');

  await db.insert(schema.bracketMatches).values({
    roundId: advanceRound.id,
    position: 1,
    player1Id: tp1.id,
    player2Id: tp2.id,
    player1Score: 200,
    player2Score: 180,
    winnerId: tp1.id,
  });

  const [sidepot] = await db
    .insert(schema.sidepots)
    .values({
      tournamentId: tournament.id,
      name: 'High Game',
      type: 'high_game',
      entryFee: 1000,
    })
    .returning();
  if (!sidepot) throw new Error('Failed to seed sidepot');

  return {
    tournamentId: tournament.id,
    stageId: stage.id,
    squadId: squad.id,
    tournamentPlayer1Id: tp1.id,
    tournamentPlayer2Id: tp2.id,
    openPoolId: openPool.id,
    readyPoolId: readyPool.id,
    progressMatchId: progressMatch.id,
    advancePoolId: advancePool.id,
    sidepotId: sidepot.id,
  };
}

const fakeId = '00000000-0000-0000-0000-000000000001';

function mutationCalls(
  c: ReturnType<typeof caller>,
  resources: Resources = {
    tournamentId: fakeId,
    stageId: fakeId,
    squadId: fakeId,
    tournamentPlayer1Id: fakeId,
    tournamentPlayer2Id: '00000000-0000-0000-0000-000000000002',
    openPoolId: fakeId,
    readyPoolId: fakeId,
    progressMatchId: fakeId,
    advancePoolId: fakeId,
    sidepotId: fakeId,
  },
) {
  return {
    'squad.create': () =>
      c.squad.create({
        stageId: resources.stageId,
        name: 'Unauthorized Squad',
        date: new Date('2026-08-01T10:00:00Z').toISOString(),
        startTime: '10:00',
        sortOrder: 1,
      }),
    'squad.enterScore': () =>
      c.squad.enterScore({
        tournamentPlayerId: resources.tournamentPlayer1Id,
        gameNumber: 1,
        rawScore: 200,
        pins: [],
      }),
    'squad.batchEnterScores': () =>
      c.squad.batchEnterScores({
        scores: [
          {
            tournamentPlayerId: resources.tournamentPlayer2Id,
            gameNumber: 1,
            rawScore: 190,
            pins: [],
          },
          {
            tournamentPlayerId: resources.tournamentPlayer2Id,
            gameNumber: 2,
            rawScore: 195,
            pins: [],
          },
        ],
      }),
    'bracket.createPool': () =>
      c.bracket.createPool({
        tournamentId: resources.tournamentId,
        name: 'Unauthorized Pool',
        type: 'eight_person_forward',
        entryFee: 0,
        maxPlayers: 8,
        config: {},
      }),
    'bracket.joinPool': () =>
      c.bracket.joinPool({
        poolId: resources.openPoolId,
        playerId: resources.tournamentPlayer1Id,
      }),
    'bracket.shuffle': () => c.bracket.shuffle({ poolId: resources.readyPoolId }),
    'bracket.enterScore': () =>
      c.bracket.enterScore({
        matchId: resources.progressMatchId,
        player1Score: 210,
        player2Score: 180,
      }),
    'bracket.advanceRound': () => c.bracket.advanceRound({ poolId: resources.advancePoolId }),
    'sidepot.create': () =>
      c.sidepot.create({
        tournamentId: resources.tournamentId,
        name: 'Unauthorized Sidepot',
        type: 'high_game',
        entryFee: 500,
      }),
    'sidepot.join': () =>
      c.sidepot.join({
        sidepotId: resources.sidepotId,
        tournamentPlayerId: resources.tournamentPlayer1Id,
      }),
  };
}

function queryCalls(
  c: ReturnType<typeof caller>,
  resources: Resources = {
    tournamentId: fakeId,
    stageId: fakeId,
    squadId: fakeId,
    tournamentPlayer1Id: fakeId,
    tournamentPlayer2Id: '00000000-0000-0000-0000-000000000002',
    openPoolId: fakeId,
    readyPoolId: fakeId,
    progressMatchId: fakeId,
    advancePoolId: fakeId,
    sidepotId: fakeId,
  },
) {
  return {
    'squad.list': () => c.squad.list({ tournamentId: resources.tournamentId }),
    'squad.byId': () => c.squad.byId(resources.squadId),
    'squad.getScoreSheet': () => c.squad.getScoreSheet(resources.squadId),
    'bracket.list': () => c.bracket.list({ tournamentId: resources.tournamentId }),
    'bracket.getBracket': () => c.bracket.getBracket(resources.openPoolId),
    'bracket.calculatePayouts': () => c.bracket.calculatePayouts({ poolId: resources.openPoolId }),
    'sidepot.list': () => c.sidepot.list({ tournamentId: resources.tournamentId }),
    'sidepot.calculateResults': () => c.sidepot.calculateResults(resources.sidepotId),
    'sidepot.getWinners': () => c.sidepot.getWinners(resources.sidepotId),
  };
}

const structuralMutationNames = [
  'squad.create',
  'bracket.createPool',
  'bracket.joinPool',
  'sidepot.create',
  'sidepot.join',
] as const;

async function resetFixtures() {
  await queryClient`TRUNCATE organizations CASCADE`;
  await queryClient`DELETE FROM profiles WHERE id LIKE 'authz-%'`;
}

beforeEach(resetFixtures);

afterAll(async () => {
  await resetFixtures();
  await queryClient.end();
});

describe('nested tournament resource mutation authorization', () => {
  for (const mutationName of Object.keys(mutationCalls(caller(null, null)))) {
    it(`rejects anonymous ${mutationName}`, async () => {
      const call = mutationCalls(caller(null, null))[
        mutationName as keyof ReturnType<typeof mutationCalls>
      ];
      await expect(call()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it(`rejects member role for ${mutationName}`, async () => {
      const organization = await seedOrganization(`member-${mutationName}`, {
        profileId: `authz-member-${mutationName}`,
        role: 'member',
      });
      const call = mutationCalls(caller(`authz-member-${mutationName}`, organization.id))[
        mutationName as keyof ReturnType<typeof mutationCalls>
      ];
      await expect(call()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it(`rejects cross-organization ${mutationName}`, async () => {
      const ownOrganization = await seedOrganization(`own-${mutationName}`, {
        profileId: `authz-owner-${mutationName}`,
        role: 'owner',
      });
      const foreignOrganization = await seedOrganization(`foreign-${mutationName}`);
      const resources = await seedResources(foreignOrganization.id, mutationName);
      const call = mutationCalls(
        caller(`authz-owner-${mutationName}`, ownOrganization.id),
        resources,
      )[mutationName as keyof ReturnType<typeof mutationCalls>];
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  }

  for (const mutationName of structuralMutationNames) {
    it(`rejects scorer role for structural mutation ${mutationName}`, async () => {
      const scorerId = `authz-scorer-denied-${mutationName}`;
      const organization = await seedOrganization(`scorer-denied-${mutationName}`, {
        profileId: scorerId,
        role: 'scorer',
      });
      const call = mutationCalls(caller(scorerId, organization.id))[mutationName];
      await expect(call()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  }

  it.each(['owner', 'admin'] as const)(
    'allows %s role to manage owned squad, bracket, and sidepot structure',
    async (role) => {
      const operatorId = `authz-${role}-allowed`;
      const organization = await seedOrganization(`${role}-allowed`, {
        profileId: operatorId,
        role,
      });
      const resources = await seedResources(organization.id, `${role}-allowed`);
      const calls = mutationCalls(caller(operatorId, organization.id), resources);

      await expect(calls['squad.create']()).resolves.toMatchObject({ stageId: resources.stageId });
      await expect(calls['bracket.createPool']()).resolves.toHaveProperty('id');
      await expect(calls['bracket.joinPool']()).resolves.toHaveProperty('id');
      await expect(calls['sidepot.create']()).resolves.toHaveProperty('id');
      await expect(calls['sidepot.join']()).resolves.toHaveProperty('id');
    },
  );

  it('allows a scorer to operate owned scores and bracket progression', async () => {
    const organization = await seedOrganization('scorer-allowed', {
      profileId: 'authz-scorer-allowed',
      role: 'scorer',
    });
    const resources = await seedResources(organization.id, 'scorer-allowed');
    const calls = mutationCalls(caller('authz-scorer-allowed', organization.id), resources);

    await expect(calls['squad.enterScore']()).resolves.toHaveProperty('id');
    await expect(calls['squad.batchEnterScores']()).resolves.toHaveLength(2);
    await expect(calls['bracket.shuffle']()).resolves.toMatchObject({ success: true });
    await expect(calls['bracket.enterScore']()).resolves.toHaveProperty('winnerId');
    await expect(calls['bracket.advanceRound']()).resolves.toMatchObject({
      success: true,
      completed: true,
    });
  });

  it('serializes concurrent bracket joins so capacity cannot be exceeded', async () => {
    const operatorId = 'authz-owner-bracket-concurrency';
    const organization = await seedOrganization('bracket-concurrency', {
      profileId: operatorId,
      role: 'owner',
    });
    const resources = await seedResources(organization.id, 'bracket-concurrency');

    await db
      .update(schema.bracketPools)
      .set({
        maxPlayers: 1,
        config: {
          handicap: false,
          allowMultipleEntries: true,
          maxEntriesPerPlayer: 10,
          payoutRatio: 0.8,
          bracketSize: 8,
        },
      })
      .where(eq(schema.bracketPools.id, resources.openPoolId));

    const c = caller(operatorId, organization.id);
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        c.bracket.joinPool({
          poolId: resources.openPoolId,
          playerId: resources.tournamentPlayer1Id,
        }),
      ),
    );

    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [entryCount] = await queryClient<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM bracket_entries
      WHERE "bracketPoolId" = ${resources.openPoolId}
    `;
    expect(entryCount?.count).toBe(1);
  });

  it('serializes concurrent sidepot joins so entry limits cannot be exceeded', async () => {
    const operatorId = 'authz-owner-sidepot-concurrency';
    const organization = await seedOrganization('sidepot-concurrency', {
      profileId: operatorId,
      role: 'owner',
    });
    const resources = await seedResources(organization.id, 'sidepot-concurrency');

    await db
      .update(schema.sidepots)
      .set({
        config: {
          handicap: false,
          maxEntries: 1,
          payoutRatio: 0.8,
          gamesIncluded: [1, 2, 3],
          gender: 'all',
        },
      })
      .where(eq(schema.sidepots.id, resources.sidepotId));

    const c = caller(operatorId, organization.id);
    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        c.sidepot.join({
          sidepotId: resources.sidepotId,
          tournamentPlayerId: resources.tournamentPlayer1Id,
        }),
      ),
    );

    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const [entryCount] = await queryClient<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM sidepot_entries
      WHERE "sidepotId" = ${resources.sidepotId}
    `;
    expect(entryCount?.count).toBe(1);
  });

  it('rolls back bracket shuffle when match creation fails', async () => {
    const operatorId = 'authz-scorer-shuffle-rollback';
    const organization = await seedOrganization('shuffle-rollback', {
      profileId: operatorId,
      role: 'scorer',
    });
    const resources = await seedResources(organization.id, 'shuffle-rollback');

    await queryClient.unsafe(`
      CREATE OR REPLACE FUNCTION integrity_fail_bracket_match_insert()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'injected bracket match failure';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryClient.unsafe(`
      CREATE TRIGGER integrity_fail_bracket_match_insert_trigger
      BEFORE INSERT ON bracket_matches
      FOR EACH ROW EXECUTE FUNCTION integrity_fail_bracket_match_insert();
    `);

    try {
      await expect(
        caller(operatorId, organization.id).bracket.shuffle({
          poolId: resources.readyPoolId,
        }),
      ).rejects.toThrow();

      const rounds = await queryClient<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM bracket_rounds
        WHERE "bracketPoolId" = ${resources.readyPoolId}
      `;
      const [pool] = await queryClient<{ status: string }[]>`
        SELECT status FROM bracket_pools WHERE id = ${resources.readyPoolId}
      `;
      expect(rounds[0]?.count).toBe(0);
      expect(pool?.status).toBe('open');
    } finally {
      await queryClient.unsafe(`
        DROP TRIGGER IF EXISTS integrity_fail_bracket_match_insert_trigger ON bracket_matches;
      `);
      await queryClient.unsafe(`DROP FUNCTION IF EXISTS integrity_fail_bracket_match_insert();`);
    }
  });

  it('rolls back bracket round advancement when next-match creation fails', async () => {
    const operatorId = 'authz-scorer-advance-rollback';
    const organization = await seedOrganization('advance-rollback', {
      profileId: operatorId,
      role: 'scorer',
    });
    const resources = await seedResources(organization.id, 'advance-rollback');

    const [round] = await queryClient<{ id: string }[]>`
      SELECT id FROM bracket_rounds
      WHERE "bracketPoolId" = ${resources.advancePoolId}
      LIMIT 1
    `;
    if (!round) throw new Error('Advance round fixture missing');

    await db.insert(schema.bracketMatches).values({
      roundId: round.id,
      position: 2,
      player1Id: resources.tournamentPlayer2Id,
      player2Id: resources.tournamentPlayer1Id,
      player1Score: 210,
      player2Score: 190,
      winnerId: resources.tournamentPlayer2Id,
    });

    await queryClient.unsafe(`
      CREATE OR REPLACE FUNCTION integrity_fail_bracket_match_insert()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'injected bracket match failure';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryClient.unsafe(`
      CREATE TRIGGER integrity_fail_bracket_match_insert_trigger
      BEFORE INSERT ON bracket_matches
      FOR EACH ROW EXECUTE FUNCTION integrity_fail_bracket_match_insert();
    `);

    try {
      await expect(
        caller(operatorId, organization.id).bracket.advanceRound({
          poolId: resources.advancePoolId,
        }),
      ).rejects.toThrow();

      const [roundState] = await queryClient<{ completed: boolean }[]>`
        SELECT completed FROM bracket_rounds WHERE id = ${round.id}
      `;
      const [roundCount] = await queryClient<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM bracket_rounds
        WHERE "bracketPoolId" = ${resources.advancePoolId}
      `;
      expect(roundState?.completed).toBe(false);
      expect(roundCount?.count).toBe(1);
    } finally {
      await queryClient.unsafe(`
        DROP TRIGGER IF EXISTS integrity_fail_bracket_match_insert_trigger ON bracket_matches;
      `);
      await queryClient.unsafe(`DROP FUNCTION IF EXISTS integrity_fail_bracket_match_insert();`);
    }
  });
});

describe('durable score change audit', () => {
  it('records actor and before/after values for game creation and correction', async () => {
    const operatorId = 'authz-audit-game-owner';
    const organization = await seedOrganization('audit-game', {
      profileId: operatorId,
      role: 'owner',
    });
    const resources = await seedResources(organization.id, 'audit-game');
    const c = caller(operatorId, organization.id);

    const created = await c.squad.enterScore({
      tournamentPlayerId: resources.tournamentPlayer1Id,
      gameNumber: 1,
      rawScore: 180,
      pins: [],
    });
    const corrected = await c.squad.enterScore({
      tournamentPlayerId: resources.tournamentPlayer1Id,
      gameNumber: 1,
      rawScore: 210,
      pins: [],
    });

    expect(corrected.id).toBe(created.id);
    const auditRows = await queryClient<
      {
        actorProfileId: string;
        organizationId: string;
        tournamentId: string;
        resourceType: string;
        resourceId: string;
        operation: string;
        previousValue: { rawScore: number } | null;
        newValue: { rawScore: number };
      }[]
    >`
      SELECT
        "actorProfileId",
        "organizationId",
        "tournamentId",
        "resourceType",
        "resourceId",
        operation,
        "previousValue",
        "newValue"
      FROM score_audit_logs
      WHERE "resourceId" = ${created.id}
      ORDER BY "createdAt", id
    `;

    expect(auditRows).toHaveLength(2);
    expect(auditRows[0]).toMatchObject({
      actorProfileId: operatorId,
      organizationId: organization.id,
      tournamentId: resources.tournamentId,
      resourceType: 'game',
      resourceId: created.id,
      operation: 'created',
      previousValue: null,
      newValue: { rawScore: 180 },
    });
    expect(auditRows[1]).toMatchObject({
      operation: 'updated',
      previousValue: { rawScore: 180 },
      newValue: { rawScore: 210 },
    });

    const [gameCount] = await queryClient<{ count: number }[]>`
      SELECT count(*)::int AS count
      FROM games
      WHERE "tournamentPlayerId" = ${resources.tournamentPlayer1Id}
        AND "gameNumber" = 1
    `;
    expect(gameCount?.count).toBe(1);
  });

  it('records bracket match score entry with the authenticated actor', async () => {
    const operatorId = 'authz-audit-bracket-scorer';
    const organization = await seedOrganization('audit-bracket', {
      profileId: operatorId,
      role: 'scorer',
    });
    const resources = await seedResources(organization.id, 'audit-bracket');

    await caller(operatorId, organization.id).bracket.enterScore({
      matchId: resources.progressMatchId,
      player1Score: 220,
      player2Score: 200,
    });

    const [auditRow] = await queryClient<
      {
        actorProfileId: string;
        organizationId: string;
        tournamentId: string;
        resourceType: string;
        resourceId: string;
        operation: string;
        previousValue: unknown;
        newValue: { player1Score: number; player2Score: number };
      }[]
    >`
      SELECT
        "actorProfileId",
        "organizationId",
        "tournamentId",
        "resourceType",
        "resourceId",
        operation,
        "previousValue",
        "newValue"
      FROM score_audit_logs
      WHERE "resourceType" = 'bracket_match'
        AND "resourceId" = ${resources.progressMatchId}
    `;

    expect(auditRow).toMatchObject({
      actorProfileId: operatorId,
      organizationId: organization.id,
      tournamentId: resources.tournamentId,
      resourceType: 'bracket_match',
      resourceId: resources.progressMatchId,
      operation: 'created',
      previousValue: null,
      newValue: { player1Score: 220, player2Score: 200 },
    });
  });

  it('rolls back an entire score batch when a later game write fails', async () => {
    const operatorId = 'authz-audit-batch-owner';
    const organization = await seedOrganization('audit-batch', {
      profileId: operatorId,
      role: 'owner',
    });
    const resources = await seedResources(organization.id, 'audit-batch');

    await queryClient.unsafe(`
      CREATE OR REPLACE FUNCTION integrity_fail_second_game_insert()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."gameNumber" = 2 THEN
          RAISE EXCEPTION 'injected second game failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryClient.unsafe(`
      CREATE TRIGGER integrity_fail_second_game_insert_trigger
      BEFORE INSERT ON games
      FOR EACH ROW EXECUTE FUNCTION integrity_fail_second_game_insert();
    `);

    try {
      await expect(
        caller(operatorId, organization.id).squad.batchEnterScores({
          scores: [
            {
              tournamentPlayerId: resources.tournamentPlayer1Id,
              gameNumber: 1,
              rawScore: 180,
              pins: [],
            },
            {
              tournamentPlayerId: resources.tournamentPlayer1Id,
              gameNumber: 2,
              rawScore: 190,
              pins: [],
            },
          ],
        }),
      ).rejects.toThrow();

      const [gameCount] = await queryClient<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM games
        WHERE "tournamentPlayerId" = ${resources.tournamentPlayer1Id}
      `;
      expect(gameCount?.count).toBe(0);
    } finally {
      await queryClient.unsafe(`
        DROP TRIGGER IF EXISTS integrity_fail_second_game_insert_trigger ON games;
      `);
      await queryClient.unsafe(`DROP FUNCTION IF EXISTS integrity_fail_second_game_insert();`);
    }
  });
});

describe('nested tournament resource query authorization', () => {
  for (const queryName of Object.keys(queryCalls(caller(null, null)))) {
    it(`rejects anonymous ${queryName}`, async () => {
      const call = queryCalls(caller(null, null))[queryName as keyof ReturnType<typeof queryCalls>];
      await expect(call()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it(`rejects member role for ${queryName}`, async () => {
      const memberId = `authz-query-member-${queryName}`;
      const organization = await seedOrganization(`query-member-${queryName}`, {
        profileId: memberId,
        role: 'member',
      });
      const call = queryCalls(caller(memberId, organization.id))[
        queryName as keyof ReturnType<typeof queryCalls>
      ];
      await expect(call()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it(`rejects cross-organization ${queryName}`, async () => {
      const ownerId = `authz-query-owner-${queryName}`;
      const ownOrganization = await seedOrganization(`query-own-${queryName}`, {
        profileId: ownerId,
        role: 'owner',
      });
      const foreignOrganization = await seedOrganization(`query-foreign-${queryName}`);
      const resources = await seedResources(foreignOrganization.id, `query-${queryName}`);
      const call = queryCalls(caller(ownerId, ownOrganization.id), resources)[
        queryName as keyof ReturnType<typeof queryCalls>
      ];
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  }

  it.each(['owner', 'admin', 'scorer'] as const)(
    'allows %s to read owned squad, bracket, and sidepot resources',
    async (role) => {
      const operatorId = `authz-query-${role}-allowed`;
      const organization = await seedOrganization(`query-${role}-allowed`, {
        profileId: operatorId,
        role,
      });
      const resources = await seedResources(organization.id, `query-${role}-allowed`);
      await db
        .update(schema.bracketPools)
        .set({ status: 'completed' })
        .where(eq(schema.bracketPools.id, resources.openPoolId));

      const calls = queryCalls(caller(operatorId, organization.id), resources);
      for (const call of Object.values(calls)) {
        await expect(call()).resolves.toBeDefined();
      }
    },
  );
});
