import { test, expect } from '@playwright/test'

const NONEXISTENT_TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

test.describe('Player Registration / Roster', () => {
  test('page loads without 404 for non-existent tournament', async ({ page }) => {
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/players`)
    await page.waitForLoadState('domcontentloaded')

    const bodyText = page.locator('body')
    await expect(bodyText).not.toHaveText(/Page not found/)
  })

  test('shows error state for non-existent tournament', async ({ page }) => {
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/players`)
    await page.waitForLoadState('domcontentloaded')

    // The tournament.byId API returns NOT_FOUND for non-existent tournament
    const errorMessage = page.locator('text=Failed to load tournament')
    await expect(errorMessage).toBeVisible({ timeout: 15_000 })

    // Assert the error container has the correct styling (red border/background)
    const errorContainer = page.locator('.border-red-200')
    await expect(errorContainer).toBeVisible()

    // Assert the page title area is not present (since we're in error state)
    await expect(page.locator('text=Player Roster')).not.toBeVisible()
  })
})
