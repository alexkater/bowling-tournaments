import { test, expect } from '@playwright/test'

const NONEXISTENT_TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'
const NONEXISTENT_SQUAD_ID = '00000000-0000-0000-0000-000000000099'

test.describe('Score Entry', () => {
  test('shows loading skeleton or error state for non-existent squad', async ({ page }) => {
    await page.goto(
      `/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/squads/${NONEXISTENT_SQUAD_ID}/scores`,
    )
    await page.waitForLoadState('domcontentloaded')

    // Verify the page loaded without 404
    const body = page.locator('body')
    await expect(body).not.toHaveText(/Page not found/)
  })

  test('shows error state for non-existent squad', async ({ page }) => {
    await page.goto(
      `/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/squads/${NONEXISTENT_SQUAD_ID}/scores`,
    )
    await page.waitForLoadState('domcontentloaded')

    // The API returns NOT_FOUND or a generic error for non-existent squads
    const notFoundMsg = page.locator('text=Squad not found')
    const failedMsg = page.locator('text=Failed to load score sheet')

    await expect(
      notFoundMsg.or(failedMsg),
    ).toBeVisible({ timeout: 15_000 })

    // Assert the error container styling
    const errorContainer = page.locator('.border-red-200')
    await expect(errorContainer).toBeVisible()

    // Assert a "Back to tournament" link exists in the error state
    const backLink = page.locator('a:has-text("Back to tournament")')
    await expect(backLink).toBeVisible()

    await expect(backLink).toHaveAttribute(
      'href',
      `/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}`,
    )
  })
})
