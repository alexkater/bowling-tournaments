import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [webDockerfile, deployServer, productionCompose, communicationsPlan, apiServer, envExample] = await Promise.all([
  readFile(new URL('../Dockerfile.web', import.meta.url), 'utf8'),
  readFile(new URL('./deploy-server.sh', import.meta.url), 'utf8'),
  readFile(new URL('../docker-compose.prod.yml', import.meta.url), 'utf8'),
  readFile(new URL('../docs/comms-hardening-plan.md', import.meta.url), 'utf8'),
  readFile(new URL('../apps/api/src/server.ts', import.meta.url), 'utf8'),
  readFile(new URL('../.env.example', import.meta.url), 'utf8'),
]);

test('Next.js standalone listens on every container interface', () => {
  const runnerStage = webDockerfile.split('FROM base AS runner\n', 2)[1];
  assert.ok(runnerStage, 'runner stage is required');

  const runtimeEnvironment = runnerStage.split('USER nextjs\n', 1)[0];
  assert.match(runtimeEnvironment, /^ENV HOSTNAME=0\.0\.0\.0$/m);
});

test('production deploy waits for Docker health after HTTP checks', () => {
  assert.match(deployServer, /wait_for_service_health\(\)/);
  assert.match(deployServer, /if \[\[ -z "\$container_id" \]\]/);
  assert.match(deployServer, /if \[\[ "\$status" == unhealthy \]\]/);
  assert.match(deployServer, /wait_for_service_health api/);
  assert.match(deployServer, /wait_for_service_health web/);
});

test('production deploy fails before building when free disk is below 3 GiB', () => {
  assert.match(deployServer, /MIN_FREE_DISK_KB=3145728/);
  assert.match(deployServer, /available_disk_kb < MIN_FREE_DISK_KB/);
  const diskCheckCall = deployServer.lastIndexOf('\ncheck_free_disk\n');
  assert.ok(diskCheckCall > 0, 'disk preflight must be called');
  assert.ok(
    diskCheckCall < deployServer.indexOf('Building production images'),
    'disk preflight must run before image builds',
  );
});

test('production email delivery requires an explicit verified sender', () => {
  assert.match(productionCompose, /EMAIL_FROM: \$\{EMAIL_FROM:-\}/);
  assert.match(communicationsPlan, /RESEND_API_KEY/);
  assert.match(communicationsPlan, /EMAIL_FROM/);
  assert.match(communicationsPlan, /verified/i);
  assert.match(envExample, /^EMAIL_FROM=/m);
  assert.match(envExample, /^JWT_SECRET=/m);
});

test('production API receives the canonical app URL for account action links', () => {
  const apiService = productionCompose.split('\n  api:\n', 2)[1]?.split('\n  web:\n', 1)[0];
  assert.ok(apiService, 'api service is required');
  assert.match(apiService, /NEXT_PUBLIC_APP_URL: \$\{NEXT_PUBLIC_APP_URL:\?NEXT_PUBLIC_APP_URL is required\}/);
});

test('API trusts one proxy hop and supplies the action-link secret to the email worker', () => {
  assert.match(apiServer, /Fastify\(\{ logger: true, trustProxy: 1 \}\)/);
  assert.match(apiServer, /actionLinkSecret: process\.env\.JWT_SECRET/);
});
