import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflowUrl = new URL('../.github/workflows/ci.yml', import.meta.url)

test('CI runs Playwright E2E with PostgreSQL and Chromium', async () => {
  const workflow = await readFile(workflowUrl, 'utf8')

  assert.match(workflow, /^  e2e:\s*$/m, 'CI must define an e2e job')
  assert.match(workflow, /image:\s*postgres:16-alpine/, 'E2E must use an isolated PostgreSQL service')
  assert.match(workflow, /drizzle-kit push/, 'E2E must provision the database schema')
  assert.match(workflow, /playwright install --with-deps chromium/, 'E2E must install Chromium and OS dependencies')
  assert.match(
    workflow,
    /playwright test e2e\/player-onboarding\.spec\.ts/,
    'E2E must execute the critical player onboarding journey',
  )
  assert.match(
    workflow,
    /player-onboarding\.spec\.ts e2e\/organizer-announcement\.spec\.ts/,
    'E2E must execute the organizer announcement journey',
  )
})
