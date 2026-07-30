import { execSync } from 'node:child_process'
import { beforeAll } from 'vitest'

const testUrl = process.env.DATABASE_TEST_URL
if (testUrl) {
  process.env.DATABASE_URL = testUrl
}

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-for-integration-tests'

let didPush = false

beforeAll(() => {
  if (!didPush) {
    execSync('pnpm --filter @bowling/db exec drizzle-kit push', {
      env: { ...process.env },
      stdio: 'pipe',
      timeout: 60_000,
    })
    didPush = true
  }
})
