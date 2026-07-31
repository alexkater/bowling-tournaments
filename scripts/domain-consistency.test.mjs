import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const canonicalDomain = 'bolos.mogambo.xyz';
const legacyDomain = ['bowling', 'mogambo.xyz'].join('.');
const canonicalFiles = [
  'deploy.sh',
  'scripts/configure-production-env.test.mjs',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  'README.md',
  'docs/production-deployment.md',
  'AGENTS.md',
  'CLAUDE.md',
  'infra/nginx/bolos.mogambo.xyz.conf',
];

test('all production configuration uses the canonical Bowling domain', async () => {
  for (const relativePath of canonicalFiles) {
    const content = await readFile(path.join(root, relativePath), 'utf8');
    assert.match(content, new RegExp(canonicalDomain.replaceAll('.', '\\.')), `${relativePath} must reference ${canonicalDomain}`);
    assert.doesNotMatch(content, new RegExp(legacyDomain.replaceAll('.', '\\.')), `${relativePath} must not reference ${legacyDomain}`);
  }
});

test('the legacy Nginx template has been replaced', async () => {
  await assert.rejects(access(path.join(root, 'infra/nginx', `${legacyDomain}.conf`)));
});

test('server deploy safely replaces an enabled legacy Nginx route', async () => {
  const content = await readFile(path.join(root, 'scripts/deploy-server.sh'), 'utf8');

  assert.match(content, new RegExp(canonicalDomain.replaceAll('.', '\\.')));
  assert.match(content, new RegExp(`/etc/nginx/sites-enabled/${legacyDomain.replaceAll('.', '\\.')}\\.conf`));
  assert.match(content, /LEGACY_NGINX_WAS_ENABLED=true/);
  assert.match(content, /ln -sfn "\$LEGACY_NGINX_SITE" "\$LEGACY_NGINX_ENABLED"/);
});
