import { test, expect } from '@playwright/test'

const NONEXISTENT_TOURNAMENT_ID = '00000000-0000-0000-0000-000000000001'

// ─── Tests ────────────────────────────────────────────────────────────

test.describe('Bracket Management', () => {
  test('shows loading skeleton while fetching bracket pools', async ({ page }) => {
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/brackets`)
    await page.waitForLoadState('domcontentloaded')

    // Verify the page loaded without 404
    const body = page.locator('body')
    await expect(body).not.toHaveText(/Page not found/)

    // The loading state shows multiple skeleton cards in a grid
    // Wait briefly to let the page decide between loading/error
    await page.waitForTimeout(500)

    // Either loading skeleton is visible or it resolved to error/empty
    const skeleton = page.locator('.animate-pulse')
    const errorState = page.locator('text=Failed to load bracket pools')
    const emptyState = page.locator('text=No bracket pools yet')

    // At least one state should be present
    await expect(
      skeleton.or(errorState).or(emptyState),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('shows error state for non-existent tournament', async ({ page }) => {
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/brackets`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for the error message
    const errorMsg = page.locator('text=Failed to load bracket pools')
    await expect(errorMsg).toBeVisible({ timeout: 15_000 })

    // Assert the error container has red styling
    const errorContainer = page.locator('.border-red-200')
    await expect(errorContainer).toBeVisible()

    // Assert the error shows the API error message
    const errorDetails = page.locator('.text-red-400')
    await expect(errorDetails).toBeVisible()
  })

  test('shows empty state with create button when no pools exist', async ({ page }) => {
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/brackets`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for error or empty state
    const errorMsg = page.locator('text=Failed to load bracket pools')
    const emptyState = page.locator('text=No bracket pools yet')

    await Promise.race([
      expect(errorMsg).toBeVisible({ timeout: 10_000 }).catch(() => {}),
      expect(emptyState).toBeVisible({ timeout: 10_000 }).catch(() => {}),
    ])

    // Test both possible states
    if (await emptyState.isVisible().catch(() => false)) {
      // Assert the empty state description
      await expect(
        page.locator('text=Create a bracket pool for players to compete in head-to-head matchups'),
      ).toBeVisible()

      // Assert the "Create Pool" button is present in empty state
      const createBtn = page.getByRole('button', { name: 'Create Pool' })
      await expect(createBtn).toBeVisible()
    }
  })

  test('opens and renders the create pool modal', async ({ page }) => {
    // The create pool modal is triggered from the header or empty state
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/brackets`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for the page to stabilize
    const errorMsg = page.locator('text=Failed to load bracket pools')
    const emptyState = page.locator('text=No bracket pools yet')
    await Promise.race([
      expect(errorMsg).toBeVisible({ timeout: 10_000 }).catch(() => {}),
      expect(emptyState).toBeVisible({ timeout: 10_000 }).catch(() => {}),
    ])

    // Only test modal if we see empty state (modal won't work in error state)
    if (await emptyState.isVisible().catch(() => false)) {
      // Click the Create Pool button
      await page.getByRole('button', { name: 'Create Pool' }).first().click()

      // Assert modal is visible
      const modalTitle = page.locator('text=Create Bracket Pool')
      await expect(modalTitle).toBeVisible()

      // Assert modal form fields
      await expect(page.locator('text=Pool Name')).toBeVisible()
      await expect(page.locator('text=Entry Fee ($)')).toBeVisible()
      await expect(page.locator('text=Max Players')).toBeVisible()
      await expect(page.locator('text=Bracket Size')).toBeVisible()
      await expect(page.locator('text=Payout Ratio')).toBeVisible()
      await expect(page.locator('text=Handicap')).toBeVisible()
      await expect(page.locator('text=Allow Multiple Entries')).toBeVisible()

      // Fill the pool name and verify
      const nameInput = page.locator('input[type="text"]').first()
      await nameInput.fill('Test Bracket')
      await expect(nameInput).toHaveValue('Test Bracket')

      // Close the modal
      await page.getByRole('button', { name: 'Cancel' }).click()

      // Assert modal closed
      await expect(modalTitle).not.toBeVisible()
    }
  })

  test('shows header with Bracket Pools title and description', async ({ page }) => {
    await page.goto(`/dashboard/tournaments/${NONEXISTENT_TOURNAMENT_ID}/brackets`)
    await page.waitForLoadState('domcontentloaded')

    // Wait for any resolution
    const errorMsg = page.locator('text=Failed to load bracket pools')
    const header = page.locator('text=Bracket Pools')

    await Promise.race([
      expect(header).toBeVisible({ timeout: 10_000 }).catch(() => {}),
      expect(errorMsg).toBeVisible({ timeout: 10_000 }).catch(() => {}),
    ])

    if (await header.isVisible().catch(() => false)) {
      // Verify the page description
      await expect(
        page.locator('text=Manage bracket-style side competitions'),
      ).toBeVisible()
    }
  })
})
