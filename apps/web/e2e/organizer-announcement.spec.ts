import { expect, test } from '@playwright/test'
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import type { AppRouter } from '@bowling/api'

const apiUrl = 'http://localhost:3001/trpc'

function apiClient(token?: string, organizationId?: string) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: apiUrl,
        transformer: superjson,
        headers: () => ({
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(organizationId ? { 'x-org-id': organizationId } : {}),
        }),
      }),
    ],
  })
}

test.describe('Organizer announcements', () => {
  test('queues an announcement from the roster and exposes it to the enrolled player', async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const organizerEmail = `organizer-${suffix}@example.com`
    const playerEmail = `announcement-player-${suffix}@example.com`

    await page.goto('/signup?type=organizer')
    const organizerType = page.getByRole('button', { name: 'I organize tournaments' })
    await expect(organizerType).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('First name').fill('Announcement')
    await page.getByLabel('Last name').fill('Organizer')
    await page.getByLabel('Email address').fill(organizerEmail)
    await page.getByLabel('Password').fill('safe-test-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    const organizerToken = await page.evaluate(() => localStorage.getItem('auth_token'))
    expect(organizerToken).toBeTruthy()
    const organizerProfile = await apiClient(organizerToken!).auth.me.query()
    expect(organizerProfile.organizationId).toBeTruthy()
    const organizer = apiClient(organizerToken!, organizerProfile.organizationId!)

    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60_000)
    const tournament = await organizer.tournament.create.mutate({
      name: `Announcement E2E ${suffix}`,
      description: 'Browser announcement test',
      centerId: '00000000-0000-0000-0000-000000000000',
      status: 'published',
      category: 'open',
      maxPlayers: 10,
      allowWaitlist: true,
      startDate: startDate.toISOString(),
      endDate: new Date(startDate.getTime() + 24 * 60 * 60_000).toISOString(),
      registrationDeadline: new Date(startDate.getTime() - 24 * 60 * 60_000).toISOString(),
      stages: [{
        name: 'Finals',
        order: 0,
        format: {
          type: 'total_pins',
          gamesPerPlayer: 3,
          eventType: 'singles',
          scoring: { type: 'scratch', noTap: false },
        },
        advancement: { type: 'final' },
        squadConfig: null,
        standingsScope: 'per_squad',
      }],
    })

    const signup = await apiClient().auth.signup.mutate({
      firstName: 'Announcement',
      lastName: 'Player',
      email: playerEmail,
      password: 'safe-test-password',
      accountType: 'player',
    })
    const player = apiClient(signup.token)
    await player.enrollment.register.mutate({ tournamentId: tournament.id })

    await page.goto(`/dashboard/tournaments/${tournament.id}/players`)
    await expect(page.getByRole('heading', { name: 'Player Roster' })).toBeVisible()
    await page.getByRole('button', { name: 'Send announcement' }).click()
    await page.getByLabel('Subject').fill('Lane assignment update')
    await page.getByLabel('Message').fill('Your lane assignment will be available at check-in.')
    await page.getByRole('button', { name: 'Confirm and queue' }).click()

    await expect(page.getByTestId('announcement-success')).toContainText('Notification queued for 1 registered player.')
    const playerNotifications = await player.notification.list.query({ limit: 20, unreadOnly: true })
    expect(playerNotifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'announcement',
        title: 'Lane assignment update',
        body: 'Your lane assignment will be available at check-in.',
      }),
    ]))
  })
})
