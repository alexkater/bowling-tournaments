import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import postgres from 'postgres';

const DATA_MIGRATION_TAGS = new Set(['0001_backfill_organizer_organizations']);
const LAST_BASELINE_TAG = '0001_backfill_organizer_organizations';

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

export async function loadMigrationPlan(migrationsDir) {
  const journal = JSON.parse(
    await readFile(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  );

  return Promise.all(
    journal.entries.map(async (entry) => {
      const sql = await readFile(path.join(migrationsDir, `${entry.tag}.sql`), 'utf8');
      return {
        tag: entry.tag,
        when: entry.when,
        sql,
        hash: createHash('sha256').update(sql).digest('hex'),
      };
    }),
  );
}

export function buildBaselinePlan(plan) {
  const lastIndex = plan.findIndex((migration) => migration.tag === LAST_BASELINE_TAG);
  if (lastIndex < 0) {
    throw new Error(`Baseline migration not found: ${LAST_BASELINE_TAG}`);
  }
  return plan.slice(0, lastIndex + 1);
}

export function normalizePostgresIdentifier(identifier) {
  const bytes = Buffer.from(identifier);
  if (bytes.length <= 63) return identifier;
  return bytes.subarray(0, 63).toString('utf8');
}

export function extractExpectedSchema(plan) {
  const tables = new Set();
  const constraints = new Set();

  for (const migration of plan) {
    for (const match of migration.sql.matchAll(/CREATE TABLE "([^"]+)"/g)) {
      tables.add(match[1]);
    }
    for (const match of migration.sql.matchAll(/(?:CONSTRAINT|ADD CONSTRAINT) "([^"]+)"/g)) {
      constraints.add(normalizePostgresIdentifier(match[1]));
    }
  }

  return { tables, constraints };
}

export async function baselineExistingSchema({ databaseUrl, migrationsDir }) {
  const plan = await loadMigrationPlan(migrationsDir);
  const baselinePlan = buildBaselinePlan(plan);
  const expected = extractExpectedSchema(baselinePlan);
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

  try {
    await sql.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(hashtext('bowling-tournaments-migration-baseline'))`;

      const [{ registry }] = await transaction`
        select to_regclass('drizzle.__drizzle_migrations')::text as registry
      `;
      if (registry) {
        const [{ count }] = await transaction`
          select count(*)::integer as count from drizzle.__drizzle_migrations
        `;
        if (count > 0) {
          throw new Error('Drizzle migration journal is already populated');
        }
      }

      const tableRows = await transaction`
        select tablename
        from pg_tables
        where schemaname = 'public'
      `;
      const actualTables = new Set(tableRows.map((row) => row.tablename));
      const missingTables = difference(expected.tables, actualTables);
      const extraTables = difference(actualTables, expected.tables);
      if (missingTables.length || extraTables.length) {
        throw new Error(
          `Schema table mismatch (missing: ${missingTables.join(', ') || 'none'}; extra: ${extraTables.join(', ') || 'none'})`,
        );
      }

      const constraintRows = await transaction`
        select constraint_name
        from information_schema.table_constraints
        where constraint_schema = 'public'
          and constraint_type in ('FOREIGN KEY', 'UNIQUE')
      `;
      const actualConstraints = new Set(constraintRows.map((row) => row.constraint_name));
      const missingConstraints = difference(expected.constraints, actualConstraints);
      const extraConstraints = difference(actualConstraints, expected.constraints);
      if (missingConstraints.length || extraConstraints.length) {
        throw new Error(
          `Schema constraint mismatch (missing: ${missingConstraints.join(', ') || 'none'}; extra: ${extraConstraints.join(', ') || 'none'})`,
        );
      }

      for (const migration of baselinePlan.filter((item) => DATA_MIGRATION_TAGS.has(item.tag))) {
        for (const statement of migration.sql.split('--> statement-breakpoint')) {
          if (statement.trim()) {
            await transaction.unsafe(statement);
          }
        }
      }

      await transaction.unsafe('create schema if not exists drizzle');
      await transaction.unsafe(`
        create table if not exists drizzle.__drizzle_migrations (
          id serial primary key,
          hash text not null,
          created_at bigint
        )
      `);

      for (const migration of baselinePlan) {
        await transaction`
          insert into drizzle.__drizzle_migrations (hash, created_at)
          values (${migration.hash}, ${migration.when})
        `;
      }
    });
  } finally {
    await sql.end();
  }

  return { migrations: baselinePlan.length, tables: expected.tables.size };
}

async function main() {
  if (!process.argv.includes('--confirm-existing-schema')) {
    throw new Error('Refusing baseline without --confirm-existing-schema');
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const migrationsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'migrations',
  );
  const result = await baselineExistingSchema({
    databaseUrl: process.env.DATABASE_URL,
    migrationsDir,
  });
  console.log(`Baselined ${result.migrations} migrations after validating ${result.tables} tables`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
