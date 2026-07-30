import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { configureProductionEnv } from './configure-production-env.mjs';

const execFileAsync = promisify(execFile);

test('preserves existing secrets while updating public production routing', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bowling-prod-env-'));
  const envPath = path.join(directory, '.env');
  const existing = [
    '# existing production config',
    'POSTGRES_USER=bowling_admin',
    'POSTGRES_PASSWORD=keep-this-db-secret',
    'POSTGRES_DB=bowling_prod',
    'JWT_SECRET=keep-this-jwt-secret',
    'API_PORT=9999',
    'WEB_PORT=9998',
    'NEXT_PUBLIC_API_URL=http://old.example/trpc',
    'NEXT_PUBLIC_APP_URL=http://old.example',
    'UNRELATED_SETTING=preserve-me',
    '',
  ].join('\n');
  await writeFile(envPath, existing, { mode: 0o600 });

  await configureProductionEnv({
    envPath,
    domain: 'bowling.mogambo.xyz',
    apiPort: 3001,
    webPort: 3103,
  });

  const updated = await readFile(envPath, 'utf8');
  assert.match(updated, /^POSTGRES_USER=bowling_admin$/m);
  assert.match(updated, /^POSTGRES_PASSWORD=keep-this-db-secret$/m);
  assert.match(updated, /^POSTGRES_DB=bowling_prod$/m);
  assert.match(updated, /^JWT_SECRET=keep-this-jwt-secret$/m);
  assert.match(updated, /^API_PORT=3001$/m);
  assert.match(updated, /^WEB_PORT=3103$/m);
  assert.match(updated, /^NEXT_PUBLIC_API_URL=https:\/\/bowling\.mogambo\.xyz\/trpc$/m);
  assert.match(updated, /^NEXT_PUBLIC_APP_URL=https:\/\/bowling\.mogambo\.xyz$/m);
  assert.match(updated, /^UNRELATED_SETTING=preserve-me$/m);
});

test('creates a new production env with strong secrets and restrictive permissions', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bowling-prod-env-'));
  const envPath = path.join(directory, '.env');

  await configureProductionEnv({
    envPath,
    domain: 'bowling.mogambo.xyz',
    apiPort: 3001,
    webPort: 3103,
  });

  const content = await readFile(envPath, 'utf8');
  const values = Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split('=', 2)),
  );

  assert.equal(values.POSTGRES_USER, 'bowling');
  assert.equal(values.POSTGRES_DB, 'bowling');
  assert.match(values.POSTGRES_PASSWORD, /^[a-f0-9]{48}$/);
  assert.match(values.JWT_SECRET, /^[a-f0-9]{64}$/);
  assert.equal(values.COMPOSE_PROJECT_NAME, 'bowling-tournaments');
  assert.equal(values.NEXT_PUBLIC_APP_URL, 'https://bowling.mogambo.xyz');
  assert.equal((await stat(envPath)).mode & 0o777, 0o600);

  for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'JWT_SECRET']) {
    assert.equal(content.match(new RegExp(`^${key}=`, 'gm'))?.length, 1);
  }
});

test('rejects an invalid production domain before writing the env file', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bowling-prod-env-'));
  const envPath = path.join(directory, '.env');

  await assert.rejects(
    configureProductionEnv({
      envPath,
      domain: 'https://bowling.mogambo.xyz/unsafe',
      apiPort: 3001,
      webPort: 3103,
    }),
    /invalid domain/i,
  );

  await assert.rejects(readFile(envPath, 'utf8'), { code: 'ENOENT' });
});

test('rejects invalid production ports', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bowling-prod-env-'));

  await assert.rejects(
    configureProductionEnv({
      envPath: path.join(directory, 'api.env'),
      domain: 'bowling.mogambo.xyz',
      apiPort: 0,
      webPort: 3103,
    }),
    /invalid api port/i,
  );
  await assert.rejects(
    configureProductionEnv({
      envPath: path.join(directory, 'web.env'),
      domain: 'bowling.mogambo.xyz',
      apiPort: 3001,
      webPort: 70000,
    }),
    /invalid web port/i,
  );
});

test('CLI configures production without printing secrets', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'bowling-prod-env-'));
  const envPath = path.join(directory, '.env');
  const scriptPath = path.resolve('scripts/configure-production-env.mjs');

  const { stdout, stderr } = await execFileAsync(process.execPath, [
    scriptPath,
    '--file',
    envPath,
    '--domain',
    'bowling.mogambo.xyz',
    '--api-port',
    '3001',
    '--web-port',
    '3103',
  ]);

  const content = await readFile(envPath, 'utf8');
  assert.match(stdout, /production environment configured/i);
  assert.equal(stderr, '');
  assert.doesNotMatch(stdout, /POSTGRES_PASSWORD|JWT_SECRET|[a-f0-9]{48}/);
  assert.match(content, /^WEB_PORT=3103$/m);
});
