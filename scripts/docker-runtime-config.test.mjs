import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [webDockerfile, deployServer, productionCompose, communicationsPlan] = await Promise.all([
  readFile(new URL('../Dockerfile.web', import.meta.url), 'utf8'),
  readFile(new URL('./deploy-server.sh', import.meta.url), 'utf8'),
  readFile(new URL('../docker-compose.prod.yml', import.meta.url), 'utf8'),
  readFile(new URL('../docs/comms-hardening-plan.md', import.meta.url), 'utf8'),
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

test('production email delivery requires an explicit verified sender', () => {
  assert.match(productionCompose, /EMAIL_FROM: \$\{EMAIL_FROM:-\}/);
  assert.match(communicationsPlan, /RESEND_API_KEY/);
  assert.match(communicationsPlan, /EMAIL_FROM/);
  assert.match(communicationsPlan, /verified/i);
});
