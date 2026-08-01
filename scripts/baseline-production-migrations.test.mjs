import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildBaselinePlan,
  extractExpectedSchema,
  loadMigrationPlan,
  normalizePostgresIdentifier,
} from '../packages/db/scripts/baseline-production-migrations.mjs';

const migrationsDir = path.resolve('packages/db/migrations');

test('migration plan contains every journal entry with a stable hash', async () => {
  const plan = await loadMigrationPlan(migrationsDir);

  assert.deepEqual(
    plan.map((migration) => migration.tag),
    [
      '0000_add_center_id',
      '0001_backfill_organizer_organizations',
      '0002_add_tenant_integrity_constraints',
      '0003_yummy_frank_castle',
      '0004_numerous_wolfpack',
      '0005_easy_slapstick',
      '0006_little_molecule_man',
    ],
  );
  assert.ok(plan.every((migration) => /^[a-f0-9]{64}$/.test(migration.hash)));
});

test('expected migration schema includes credentials and tenant constraints', async () => {
  const plan = await loadMigrationPlan(migrationsDir);
  const expected = extractExpectedSchema(plan);

  assert.equal(expected.tables.size, 18);
  assert.ok(expected.tables.has('user_credentials'));
  assert.ok(expected.tables.has('notifications'));
  assert.ok(expected.tables.has('email_logs'));
  assert.ok(expected.constraints.has('user_credentials_email_unique'));
  assert.ok(expected.constraints.has('organization_members_organization_profile_unique'));
  assert.ok(expected.constraints.has('email_logs_idempotencyKey_unique'));
});

test('production baseline stops before the pending tenant constraints migration', async () => {
  const plan = await loadMigrationPlan(migrationsDir);
  const baseline = buildBaselinePlan(plan);
  const expected = extractExpectedSchema(baseline);

  assert.deepEqual(
    baseline.map((migration) => migration.tag),
    ['0000_add_center_id', '0001_backfill_organizer_organizations'],
  );
  assert.equal(expected.tables.size, 16);
  assert.equal(expected.constraints.has('organization_members_organization_profile_unique'), false);
});

test('constraint comparison uses PostgreSQL 63-byte identifier semantics', () => {
  assert.equal(
    normalizePostgresIdentifier('payment_transactions_tournamentPlayerId_tournament_players_id_fk'),
    'payment_transactions_tournamentPlayerId_tournament_players_id_f',
  );
});
