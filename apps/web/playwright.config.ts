import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  fullyParallel: !process.env.CI,
  webServer: [
    {
      command: `JWT_SECRET=${process.env.JWT_SECRET ?? 'test-only-secret'} pnpm --filter @bowling/api dev`,
      cwd: repoRoot,
      url: 'http://localhost:3001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'NEXT_PUBLIC_API_URL=http://localhost:3001/trpc pnpm --filter @bowling/web dev',
      cwd: repoRoot,
      url: 'http://localhost:3000/tournaments',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
})
