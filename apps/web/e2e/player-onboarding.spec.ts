import { expect, test } from '@playwright/test'

test.describe('Player onboarding', () => {
  test('creates a player account and lands in public tournament discovery', async ({ page }) => {
    const email = `player-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`

    await page.goto('/signup?type=player')

    const playerType = page.getByRole('button', { name: 'I am a player' })
    await expect(playerType).toHaveAttribute('aria-pressed', 'true')

    await page.getByLabel('First name').fill('Beta')
    await page.getByLabel('Last name').fill('Bowler')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill('safe-test-password')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/tournaments$/)
    await expect(page.getByRole('heading', { name: 'Find your next tournament' })).toBeVisible()

    const token = await page.evaluate(() => localStorage.getItem('auth_token'))
    expect(token).toBeTruthy()
  })
})
