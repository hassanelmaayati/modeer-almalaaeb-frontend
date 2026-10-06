import { test, expect } from '../helpers/offline.js'

const password = 'TestPass123!'
const api = 'http://127.0.0.1:8001/api/v1'

async function signIn(page, account) {
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('token'))
  await page.goto('/sign-in')
  await page.getByLabel('Email', { exact: true }).fill(`${account}@example.test`)
  await page.getByLabel('Password', { exact: true }).fill(password)
  const response = page.waitForResponse((result) => result.url().endsWith('/auth/login') && result.request().method() === 'POST')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  expect((await response).status()).toBe(200)
  await page.waitForURL('/')
}

async function authorization(page) {
  const token = await page.evaluate(() => localStorage.getItem('token'))
  return { Authorization: `Bearer ${token}` }
}

async function openGroup(page, name, view = 'joined') {
  await page.goto('/groups')
  await page.getByRole('combobox', { name: 'Group view', exact: true }).selectOption(view)
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
  await card.getByRole('button', { name: 'Open group', exact: true }).click()
  const dialog = page.getByRole('dialog', { name, exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

async function groupMembership(request, page, groupId, userId) {
  const response = await request.get(`${api}/groups/${groupId}/members`, { headers: await authorization(page) })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).find((membership) => membership.user_id === userId)
}

test('public discovery filters real backend activities and preserves private venue details', async ({ page, request }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Find your people. Get moving.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Friday Football Match', exact: true })).toBeVisible()
  await page.goto('/sports')
  await page.getByRole('combobox', { name: 'Activity', exact: true }).selectOption('2')
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Friday Football Match', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  const roomCard = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Friday Football Match', exact: true }) })
  await roomCard.getByRole('button', { name: 'View activity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Friday Football Match', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Manama · Capital', { exact: true })).toBeVisible()
  await expect(page.getByText('Private fixture meeting instructions', { exact: true })).toHaveCount(0)
  const publicRoom = await request.get(`${api}/rooms/1`)
  const publicDetails = await publicRoom.json()
  expect(publicDetails).toMatchObject({ area: 'Manama', district: 'capital' })
  expect(publicDetails).not.toHaveProperty('venue_notes')
  expect(publicDetails).not.toHaveProperty('venue_location')
  expect(errors).toEqual([])
})

test('owner creates and edits a group and invites an existing registered player', async ({ page, request }) => {
  await signIn(page, 'owner')
  await page.goto('/groups')
  await page.getByRole('button', { name: 'Create group', exact: true }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel('Group name', { exact: true }).fill('E2E Evening Team')
  await form.getByRole('textbox', { name: 'Description', exact: true }).fill('Created through the real frontend and backend')
  await form.getByRole('combobox', { name: 'Sport', exact: true }).selectOption('1')
  const createResponse = page.waitForResponse((result) => result.url().endsWith('/api/v1/groups') && result.request().method() === 'POST')
  await form.getByRole('button', { name: 'Create group', exact: true }).click()
  expect((await createResponse).status()).toBe(201)
  await expect(form.getByRole('status')).toHaveText('E2E Evening Team was created.')
  const list = await request.get(`${api}/groups`)
  const created = (await list.json()).find((group) => group.name === 'E2E Evening Team')
  expect(created).toMatchObject({ owner_id: 1, sports_id: 1 })
  const dialog = await openGroup(page, 'E2E Evening Team')
  await dialog.getByRole('button', { name: 'Edit group', exact: true }).click()
  await dialog.getByLabel('Group name', { exact: true }).fill('E2E Edited Team')
  await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill('Edited description')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'E2E Edited Team', exact: true })).toBeVisible()
  const editedDialog = page.getByRole('dialog', { name: 'E2E Edited Team', exact: true })
  await editedDialog.getByRole('combobox', { name: 'Player', exact: true }).selectOption('3')
  await editedDialog.getByRole('button', { name: 'Invite', exact: true }).click()
  await expect.poll(async () => (await groupMembership(request, page, created.id, 3))?.status).toBe('pending')
  const saved = await request.get(`${api}/groups/${created.id}`)
  expect(await saved.json()).toMatchObject({ name: 'E2E Edited Team', description: 'Edited description', owner_id: 1 })
})

test('an invited player accepts and then leaves a group with persisted membership state', async ({ page, request }) => {
  await signIn(page, 'member')
  const dialog = await openGroup(page, 'Weekend Football', 'invitations')
  await dialog.getByRole('button', { name: 'Accept invitation', exact: true }).click()
  await expect.poll(async () => (await groupMembership(request, page, 1, 2))?.status).toBe('accepted')
  await expect(dialog.getByRole('button', { name: 'Leave group', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Leave group', exact: true }).click()
  await expect.poll(async () => (await groupMembership(request, page, 1, 2))?.status).toBe('left')
  await expect(dialog.getByRole('button', { name: 'Accept invitation', exact: true })).toHaveCount(0)
})

test('an invitation can be declined and an activity request can be withdrawn', async ({ page, request }) => {
  await signIn(page, 'outsider')
  const dialog = await openGroup(page, 'Basketball Friends', 'invitations')
  await dialog.getByRole('button', { name: 'Decline invitation', exact: true }).click()
  await expect.poll(async () => (await groupMembership(request, page, 2, 3))?.status).toBe('declined')
  await page.goto('/sports')
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Friday Football Match', exact: true }) })
  await card.getByRole('button', { name: 'View activity', exact: true }).click()
  const activity = page.getByRole('dialog', { name: 'Friday Football Match', exact: true })
  await activity.getByRole('button', { name: /Request (a place|to join)/ }).click()
  await expect(activity.getByText(/Request pending\. The host must approve/)).toBeVisible()
  await activity.getByRole('button', { name: 'Withdraw request', exact: true }).click()
  await expect(activity.getByText(/You left this activity\. Another request is unavailable/)).toBeVisible()
  const response = await request.get(`${api}/rooms/1/members`, { headers: await authorization(page) })
  expect((await response.json()).find((membership) => membership.user_id === 3)).toMatchObject({ status: 'left', accepted: false })
})

test('only the owner can edit or invite, and owner removal is persisted', async ({ page, request }) => {
  await signIn(page, 'accepted')
  let dialog = await openGroup(page, 'Weekend Football')
  await expect(dialog.getByRole('button', { name: 'Edit group', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Invite', exact: true })).toHaveCount(0)
  const denied = await request.put(`${api}/groups/1`, { headers: await authorization(page), data: { name: 'Unauthorized edit' } })
  expect(denied.status()).toBe(403)
  await signIn(page, 'owner')
  dialog = await openGroup(page, 'Weekend Football')
  await dialog.getByRole('button', { name: 'Remove Test Accepted', exact: true }).click()
  await expect.poll(async () => (await groupMembership(request, page, 1, 4))?.status).toBe('removed')
  const group = await request.get(`${api}/groups/1`)
  expect((await group.json()).name).toBe('Weekend Football')
})

test('mobile activity discovery and dialogs fit a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/sports')
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Friday Football Match', exact: true }) })
  await card.getByRole('button', { name: 'View activity', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Friday Football Match', exact: true })
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'View activity', exact: true })).toBeFocused()
})

test('SPA account changes clear the previous account and owner controls without reloading', async ({ page }) => {
  await signIn(page, 'owner')
  const navigation = page.getByRole('navigation', { name: 'Main navigation', exact: true })
  await navigation.getByRole('link', { name: 'Groups', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Weekend Football', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Basketball Friends', exact: true })).toBeVisible()
  await page.evaluate(() => { window.__modeerAccountTest = 'same-document' })

  const logout = page.waitForResponse((response) => response.url().endsWith('/auth/logout') && response.request().method() === 'POST')
  await navigation.getByRole('button', { name: 'Sign out', exact: true }).click()
  expect((await logout).status()).toBe(204)
  await page.waitForURL('/')
  await expect(page.getByRole('heading', { name: 'Find your people. Get moving.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Basketball Friends', exact: true })).toHaveCount(0)

  await navigation.getByRole('link', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('accepted@example.test')
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(navigation.getByText('Signed in as Test Accepted', { exact: true })).toBeVisible()
  await navigation.getByRole('link', { name: 'Groups', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My groups', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Basketball Friends', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit group', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => window.__modeerAccountTest)).toBe('same-document')
})
