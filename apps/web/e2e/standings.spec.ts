import { test, expect } from '@playwright/test'

const NONEXISTENT_TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

test.describe('Standings', () => {
  test('shows loading skeleton or error for unauthorized access', async ({ page }) => {
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/standings`)
    await page.waitForLoadState('domcontentloaded')

    // Verify the page didn't 404
    const body = page.locator('body')
    await expect(body).not.toHaveText(/Page not found/)

    // Brief wait to let the query resolve
    await page.waitForTimeout(500)

    // Either loading skeleton or resolved error state
    const skeleton = page.locator('.animate-pulse')
    const failedMsg = page.locator('text=Failed to load standings')

    await expect(
      skeleton.or(failedMsg),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('shows error state for unauthorized access (requires auth)', async ({ page }) => {
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/standings`)
    await page.waitForLoadState('domcontentloaded')

    // requireAuth rejects before NOT_FOUND check
    const failedMsg = page.locator('text=Failed to load standings')
    await expect(failedMsg).toBeVisible({ timeout: 15_000 })

    // Assert the error container has the correct red styling
    const errorContainer = page.locator('.border-red-200')
    await expect(errorContainer).toBeVisible()

    // Assert the error shows an AlertCircle icon
    const alertIcon = page.locator('.text-red-400')
    await expect(alertIcon).toBeVisible()

    // Assert the "Back to tournament" link is present
    const backLink = page.locator('a:has-text("Back to tournament")')
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute(
      'href',
      `/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}`,
    )
  })
})
