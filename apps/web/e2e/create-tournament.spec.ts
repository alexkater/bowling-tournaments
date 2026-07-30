import { test, expect } from '@playwright/test'

test.describe('Create Tournament', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/tournaments/new')
    // Wait for the create-tournament page to hydrate
    await page.waitForLoadState('domcontentloaded')
  })

  test('renders the page with heading and step indicator', async ({ page }) => {
    // Assert heading
    const heading = page.locator('h1')
    await expect(heading).toHaveText('Create Tournament')

    // Assert step indicator labels are present
    await expect(page.locator('text=Basic Info')).toBeVisible()
    await expect(page.locator('text=Stages')).toBeVisible()
    await expect(page.locator('text=Review')).toBeVisible()

    // Assert key form fields exist on step 0
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#category')).toBeVisible()
    await expect(page.locator('#startDate')).toBeVisible()
    await expect(page.locator('#endDate')).toBeVisible()
    await expect(page.locator('#allowWaitlist')).toBeVisible()
  })

  test('shows validation error when submitting empty form', async ({ page }) => {
    // Click "Next" without filling required fields
    await page.getByRole('button', { name: 'Next' }).click()

    // Assert error banner appears with validation message
    const errorBanner = page.locator('text=Tournament name is required')
    await expect(errorBanner).toBeVisible()

    // Assert we're still on step 0 (basic info)
    await expect(page.locator('#name')).toBeVisible()
  })

  test('validates start date before end date', async ({ page }) => {
    // Fill name but set end date before start date
    await page.fill('#name', 'Summer Classic')
    await page.fill('#startDate', '2026-08-10T09:00')
    await page.fill('#endDate', '2026-08-01T09:00')

    await page.getByRole('button', { name: 'Next' }).click()

    // Assert date validation error
    await expect(page.locator('text=End date must be after start date')).toBeVisible()
  })

  test('navigates through steps and adds a stage', async ({ page }) => {
    // Step 0: fill basic info
    await page.fill('#name', 'Summer Classic 2026')
    await page.fill('#description', 'Annual summer tournament')
    await page.selectOption('#category', 'open')
    await page.fill('#startDate', '2026-08-01T09:00')
    await page.fill('#endDate', '2026-08-03T18:00')

    // Advance to step 1
    await page.getByRole('button', { name: 'Next' }).click()

    // Assert on stages step
    await expect(page.locator('text=Stage 1')).toBeVisible()
    // The first stage should be marked as "Final"
    await expect(page.locator('text=Final').first()).toBeVisible()

    // Add a second stage
    await page.getByRole('button', { name: 'Add Stage' }).click()
    await expect(page.locator('text=Stage 2')).toBeVisible()

    // Advance to step 2 (review)
    await page.getByRole('button', { name: 'Next' }).click()

    // Assert review step shows the tournament name
    await expect(page.locator('text=Summer Classic 2026')).toBeVisible()
    // Assert review shows 2 stages
    await expect(page.locator('text=Stages (2)')).toBeVisible()
    // Assert review shows the category
    await expect(page.locator('text=Open')).toBeVisible()
  })

  test('can go back from review to stages step', async ({ page }) => {
    // Fill and navigate to review
    await page.fill('#name', 'Back Navigation Test')
    await page.fill('#startDate', '2026-08-01T09:00')
    await page.fill('#endDate', '2026-08-03T18:00')
    await page.getByRole('button', { name: 'Next' }).click()
    // Now on stages
    await page.getByRole('button', { name: 'Next' }).click()
    // Now on review
    await expect(page.locator('text=Back Navigation Test')).toBeVisible()

    // Click back
    await page.getByRole('button', { name: 'Back' }).click()

    // Assert we're back on stages step with stage config visible
    await expect(page.locator('text=Stage 1')).toBeVisible()

    // Click back again
    await page.getByRole('button', { name: 'Back' }).click()

    // Assert we're back on basic info with pre-filled name
    await expect(page.locator('#name')).toHaveValue('Back Navigation Test')
  })

  test('shows create tournament button on review step', async ({ page }) => {
    // Fill and navigate to review
    await page.fill('#name', 'Ready Tournament')
    await page.fill('#startDate', '2026-08-01T09:00')
    await page.fill('#endDate', '2026-08-03T18:00')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Next' }).click()

    // Assert Create Tournament button is visible on review step
    const createBtn = page.locator('button:has-text("Create Tournament")')
    await expect(createBtn).toBeVisible()
    await expect(createBtn).toBeEnabled()
  })
})
