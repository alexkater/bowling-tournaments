import { expect, test } from '@playwright/test'
import { latestActionUrl } from './helpers/account'

test.describe('Account recovery', () => {
  test('resets a verified password through a one-time email link', async ({ page }) => {
    const email = `recovery-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`
    const oldPassword = 'safe-test-password'
    const newPassword = 'new-safe-test-password'

    await page.goto('/signup?type=player')
    await page.getByLabel('First name').fill('Recovery')
    await page.getByLabel('Last name').fill('Player')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(oldPassword)
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

    const verificationUrl = new URL(await latestActionUrl(email, 'verify_email'))
    expect(verificationUrl.search).toBe('')
    expect(verificationUrl.hash).toMatch(/^#token=/)
    await page.goto(`${verificationUrl.pathname}${verificationUrl.search}${verificationUrl.hash}`)
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible()
    await expect(page).toHaveURL(/\/verify-email$/)

    await page.goto('/forgot-password')
    await page.getByLabel('Email address').fill(email)
    await page.getByRole('button', { name: 'Send recovery link' }).click()
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

    const resetUrl = new URL(await latestActionUrl(email, 'password_reset'))
    expect(resetUrl.search).toBe('')
    expect(resetUrl.hash).toMatch(/^#token=/)
    await page.goto(`${resetUrl.pathname}${resetUrl.search}${resetUrl.hash}`)
    await expect(page).toHaveURL(/\/reset-password$/)
    await page.getByLabel('New password').fill(newPassword)
    await page.getByLabel('Confirm password').fill(newPassword)
    await page.getByRole('button', { name: 'Update password' }).click()
    await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()

    await page.getByRole('link', { name: 'Sign in' }).click()
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill(oldPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('Invalid email or password')).toBeVisible()

    await page.getByLabel('Password').fill(newPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/tournaments$/)
    await expect(page.getByRole('heading', { name: 'Find your next tournament' })).toBeVisible()
  })
})
