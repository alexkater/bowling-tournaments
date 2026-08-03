import { expect, test } from '@playwright/test'
import { latestActionUrl } from './helpers/account'

test.describe('Player onboarding', () => {
  test('creates and verifies a player account before tournament discovery', async ({ page }) => {
    const email = `player-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`
    const password = 'safe-test-password'

    await page.goto('/signup?type=player')

    const playerType = page.getByRole('button', { name: 'I am a player' })
    await expect(playerType).toHaveAttribute('aria-pressed', 'true')

    await page.getByLabel('First name').fill('Beta')
    await page.getByLabel('Last name').fill('Bowler')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull()

    await page.goto('/login')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Please verify your email before signing in')).toBeVisible()
    await page.getByRole('button', { name: 'Resend verification email' }).click()
    await expect(page.getByRole('button', { name: 'Verification email queued' })).toBeVisible()

    const verificationUrl = new URL(await latestActionUrl(email, 'verify_email'))
    expect(verificationUrl.search).toBe('')
    expect(verificationUrl.hash).toMatch(/^#token=/)
    await page.goto(`${verificationUrl.pathname}${verificationUrl.search}${verificationUrl.hash}`)
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible()
    await page.getByRole('link', { name: 'Sign in' }).click()

    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/tournaments$/)
    await expect(page.getByRole('heading', { name: 'Find your next tournament' })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeTruthy()
  })
})
