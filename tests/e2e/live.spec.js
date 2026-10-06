import { test, expect } from '@playwright/test'

// Public smoke tests explicitly prevent writes to the already-running backend.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const method = route.request().method()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      throw new Error(`Live smoke attempted a forbidden ${method} request`)
    }
    await route.continue()
  })
})

test('running frontend home and sports pages render actual backend data', async ({ page, request }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const health = await request.get('http://127.0.0.1:8000/health')
  expect(await health.json()).toEqual({ ok: true })
  const sportsResponse = await request.get('/api/v1/sports')
  expect(sportsResponse.ok()).toBeTruthy()
  const sports = await sportsResponse.json()
  const roomsResponse = await request.get('/api/v1/rooms')
  expect(roomsResponse.ok()).toBeTruthy()
  const rooms = await roomsResponse.json()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Find your people. Get moving.' })).toBeVisible()
  await page.goto('/sports')
  await expect(page.getByRole('heading', { name: 'Choose your activity', exact: true })).toBeVisible()
  for (const sport of sports) await expect(page.getByRole('combobox', { name: 'Activity', exact: true }).getByRole('option', { name: sport.name, exact: true })).toHaveCount(1)
  for (const room of rooms) await expect(page.getByRole('heading', { name: room.title, exact: true })).toBeVisible()
  if (rooms.length === 0) await expect(page.getByRole('heading', { name: 'No upcoming activities', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply filters', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('running frontend groups require a session and the real public groups API remains connected', async ({ page, request }) => {
  const response = await request.get('/api/v1/groups')
  expect(response.ok()).toBeTruthy()
  const groups = await response.json()
  expect(Array.isArray(groups)).toBe(true)
  for (const group of groups) expect(group).toMatchObject({ id: expect.any(Number), owner_id: expect.any(Number), name: expect.any(String), sports_id: expect.any(Number) })
  await page.goto('/groups')
  await expect(page.getByRole('heading', { name: 'My groups', exact: true })).toBeVisible()
  await expect(page.getByText('Sign in to see your groups and invitations.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create group', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit group', exact: true })).toHaveCount(0)
})
