import { test, expect } from '../helpers/offline.js';
import { Buffer } from 'node:buffer';

// These journeys verify persisted behavior; animated styling is covered by smoke tests.
test.use({ reducedMotion: 'reduce' });

const api = 'http://127.0.0.1:8001/api/v1';
const password = 'TestPass123!';
const bahrainInput = days => new Date(Date.now() + days * 86400000 + 3 * 3600000).toISOString().slice(0, 16);

async function signIn(page, name) {
  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill(`${name}@example.test`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('/');
  await expect(page.getByRole('button', { name: `Test ${name[0].toUpperCase()}${name.slice(1)}`, exact: true })).toBeVisible();
}
async function headers(page) {
  return { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}` };
}
async function json(request, page, method, route, data, status = 200) {
  const response = await request[method](`${api}${route}`, { headers: await headers(page), ...(data === undefined ? {} : { data }) });
  expect(response.status(), `${method.toUpperCase()} ${route}: ${await response.text()}`).toBe(status);
  return status === 204 ? null : response.json();
}
async function friendship(request, owner, member) {
  await json(request, owner, 'post', '/friends', { other_user_id: 2 }, 201);
  await json(request, member, 'patch', '/friends/1', { status: 'accepted' });
}
async function cupFromUrl(page) { return Number(new URL(page.url()).pathname.split('/').at(-1)); }

test('signup validates confirmation/governorate, preserves full Unicode passwords and revokes logout tokens', async ({ page, request }) => {
  const longPassword = `${'長い🔒'.repeat(30)}tail-A`;
  await page.goto('/sign-up');
  await page.getByLabel('User name', { exact: true }).fill('  Unicode Player  ');
  await page.getByLabel('Email', { exact: true }).fill('unicode@example.test');
  await page.getByLabel('Password', { exact: true }).fill(longPassword);
  await page.getByLabel('Confirm password', { exact: true }).fill(`${longPassword}-wrong`);
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  expect(await page.getByRole('combobox', { name: /^Governorate(?: required| ready)?$/ }).evaluate(element => element.validity.valueMissing)).toBe(true);
  await page.getByRole('combobox', { name: /^Governorate(?: required| ready)?$/ }).selectOption('northern');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords must match.');
  await page.getByLabel('Confirm password', { exact: true }).fill(longPassword);
  const signup = page.waitForResponse(response => response.url().endsWith('/auth/signup') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  expect((await signup).status()).toBe(201);
  await page.waitForURL('/');
  const me = await json(request, page, 'get', '/users/me');
  expect(me).toMatchObject({ user_name: 'Unicode Player', email: 'unicode@example.test', district: 'northern' });
  const oldHeaders = await headers(page);
  await page.getByRole('button', { name: 'Unicode Player', exact: true }).click();
  await page.getByRole('menu', { name: 'Account', exact: true }).getByRole('menuitem', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  expect((await request.get(`${api}/users/me`, { headers: oldHeaders })).status()).toBe(401);
  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill('UNICODE@example.test');
  await page.getByLabel('Password', { exact: true }).fill(`${'長い🔒'.repeat(30)}tail-B`);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(longPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('/');
  expect((await json(request, page, 'get', '/users/me')).id).toBe(me.id);
  const publicUser = await request.get(`${api}/users/${me.id}`);
  expect(await publicUser.json()).not.toHaveProperty('email');
});

test('profile edits and cleared optional fields persist across reload and preserve public/private boundaries', async ({ page, request }) => {
  const photoUrl = 'https://images.example.test/profile.png';
  await page.route(photoUrl, route => route.fulfill({
    status: 200,
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQifT6DwAC8wG39Fc21QAAAABJRU5ErkJggg==', 'base64'),
  }));
  await signIn(page, 'owner');
  await page.goto('/settings');
  await page.getByLabel('User name', { exact: true }).fill('Edited Owner');
  await page.getByLabel('Photo URL', { exact: true }).fill(photoUrl);
  await page.getByRole('textbox', { name: 'Bio', exact: true }).fill('مرحبا 🏃');
  await page.getByRole('combobox', { name: /^Governorate(?: required| ready)?$/ }).selectOption('southern');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(async () => (await json(request, page, 'get', '/users/me')).bio).toBe('مرحبا 🏃');
  await page.reload();
  await expect(page.getByLabel('User name', { exact: true })).toHaveValue('Edited Owner');
  await expect(page.getByLabel('Photo URL', { exact: true })).toHaveValue(photoUrl);
  await expect.poll(() => page.locator('.player-profile img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByRole('textbox', { name: 'Bio', exact: true }).fill('');
  await page.getByLabel('Photo URL', { exact: true }).fill('');
  await page.getByRole('combobox', { name: /^Governorate(?: required| ready)?$/ }).selectOption('');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect.poll(async () => (await json(request, page, 'get', '/users/me')).district).toBe(null);
  const me = await json(request, page, 'get', '/users/me');
  expect(me).toMatchObject({ photo_url: null, bio: null, district: null, email: 'owner@example.test' });
  const response = await request.get(`${api}/users/1`);
  expect(await response.json()).not.toHaveProperty('email');
  await page.goto('/users/1');
  await expect(page.getByRole('heading', { name: 'Edited Owner', exact: true })).toBeVisible();
  await expect(page.getByText('owner@example.test', { exact: true })).toHaveCount(0);
});

test('room creation, map pin clearing, host approval and member leaving persist through the UI', async ({ page, request, offlineContext }) => {
  await signIn(page, 'owner');
  await page.goto('/rooms/new');
  await page.getByRole('combobox', { name: /^Sport(?: required| ready)?$/ }).selectOption('1');
  await page.getByLabel('Title', { exact: true }).fill('Browser Football');
  await page.getByLabel(/^Starts \(Bahrain time\)/).fill(bahrainInput(2));
  await page.getByLabel(/^Ends \(Bahrain time\)/).fill(bahrainInput(2.1));
  await page.getByRole('combobox', { name: /^Format(?: required| ready)?$/ }).selectOption('10');
  await page.getByRole('combobox', { name: /^Governorate(?: required| ready)?$/ }).selectOption('capital');
  await page.getByRole('combobox', { name: /^Area(?: required| ready)?$/ }).selectOption('Manama');
  // The map starts at Bahrain's centre; a fixed edge pixel can fall outside its allowed bounds.
  await page.locator('.leaflet-container').click();
  await expect(page.getByRole('button', { name: 'Clear pin', exact: true })).toBeVisible();
  await page.getByLabel('Location notes (optional)', { exact: true }).fill('Private court 9');
  const created = page.waitForResponse(response => response.url().endsWith('/api/v1/rooms') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create room', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const room = await response.json();
  await page.waitForURL(`/rooms/${room.id}`);
  expect((await json(request, page, 'get', `/rooms/${room.id}`)).venue_location).toHaveProperty('latitude');
  expect(await (await request.get(`${api}/rooms/${room.id}`)).json()).not.toHaveProperty('venue_location');
  await page.getByRole('link', { name: 'Edit room', exact: true }).click();
  await page.getByRole('button', { name: 'Clear pin', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.waitForURL(`/rooms/${room.id}`);
  expect((await json(request, page, 'get', `/rooms/${room.id}`)).venue_location).toBe(null);
  const member = await (await offlineContext()).newPage();
  await signIn(member, 'member');
  await member.goto(`/rooms/${room.id}`);
  await expect(member.getByText('Meeting details: Private court 9', { exact: true })).toHaveCount(0);
  await expect(member.getByRole('link', { name: 'Edit room', exact: true })).toHaveCount(0);
  await member.getByRole('button', { name: 'Request to join', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve Test Member', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Approve Test Member', exact: true }).click();
  await expect(member.getByRole('button', { name: 'Leave room', exact: true })).toBeVisible();
  await expect(member.getByText('Meeting details: Private court 9', { exact: true })).toBeVisible();
  await member.getByRole('button', { name: 'Leave room', exact: true }).click();
  await expect.poll(async () => (await json(request, page, 'get', `/rooms/${room.id}/members`)).find(row => row.user_id === 2)?.status).toBe('left');
  await expect(member.getByText('Meeting details: Private court 9', { exact: true })).toHaveCount(0);
});

test('friend requests accept, block, unblock and unfriend with live permission changes', async ({ page, request, offlineContext }) => {
  await signIn(page, 'owner');
  const member = await (await offlineContext()).newPage();
  await signIn(member, 'member');
  await page.goto('/friends');
  await page.getByLabel('Search people', { exact: true }).fill('Test Member');
  await page.getByRole('button', { name: 'Add friend Test Member', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Friend request sent to Test Member.');
  await member.goto('/friends?tab=requests');
  await member.getByRole('button', { name: 'Accept', exact: true }).click();
  await page.goto('/friends');
  await expect(page.getByRole('link', { name: 'Message', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Block', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, block', exact: true }).click();
  const denied = await request.post(`${api}/messages`, { headers: await headers(member), data: { recipient_id: 1, body: 'Blocked message', client_request_id: '00000000-0000-4000-8000-000000000001' } });
  expect(denied.status()).toBe(403);
  await page.goto('/friends?tab=blocked');
  await page.getByRole('button', { name: 'Unblock', exact: true }).click();
  await page.goto('/friends');
  await page.getByRole('button', { name: 'Unfriend', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, unfriend', exact: true }).click();
  await expect.poll(async () => (await json(request, page, 'get', '/friends'))[0]?.status).toBe('left');
});

test('actual direct chat composes Unicode, retries a failed HTTP send with the same identity and persists read state', async ({ page, request, offlineContext }) => {
  test.setTimeout(60000);
  await signIn(page, 'owner');
  const member = await (await offlineContext()).newPage();
  await signIn(member, 'member');
  await friendship(request, page, member);
  await page.goto('/messages/direct/2');
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  const attempts = [];
  await page.route('**/api/v1/messages', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    attempts.push(route.request().postDataJSON().client_request_id);
    if (attempts.length === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Temporary offline fixture failure' }) });
    else await route.fallback();
  });
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('مرحبا 🏃 — offline chat');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const retry = page.getByRole('button', { name: 'Retry', exact: true });
  await expect(retry).toBeVisible();
  expect(await json(request, page, 'get', '/messages?user_id=2')).toEqual([]);
  await retry.click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[1]).toBe(attempts[0]);
  await expect.poll(async () => (await json(request, page, 'get', '/messages?user_id=2')).filter(row => row.body === 'مرحبا 🏃 — offline chat').length).toBe(1);
  await page.unroute('**/api/v1/messages');
  await member.setViewportSize({ width: 390, height: 844 });
  await member.goto('/messages');
  await expect(member.getByRole('link', { name: /Test Owner/ }).first()).toBeVisible();
  expect((await json(request, member, 'get', '/notifications?limit=100')).items.filter(row => row.kind.startsWith('message.') && !row.read_at)).toHaveLength(1);
  await member.goto('/messages/direct/1');
  await expect(member.getByRole('log', { name: 'Messages' }).getByText('مرحبا 🏃 — offline chat', { exact: true })).toHaveCount(1);
  await member.getByRole('textbox', { name: 'Message', exact: true }).fill('First line');
  await member.getByRole('textbox', { name: 'Message', exact: true }).press('Shift+Enter');
  await member.getByRole('textbox', { name: 'Message', exact: true }).press('End');
  await member.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
  await expect(page.getByRole('log', { name: 'Messages' }).getByText('First line', { exact: true })).toHaveCount(1);
  const unicodeBoundary = '🏃'.repeat(2000);
  await member.getByRole('textbox', { name: 'Message', exact: true }).fill(unicodeBoundary);
  await expect(member.getByLabel('Characters used', { exact: true })).toHaveText('2000/2000');
  await expect(member.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
  await member.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(async () => (await json(request, member, 'get', '/messages?user_id=1')).filter(row => row.body === unicodeBoundary).length).toBe(1);
  await member.getByRole('textbox', { name: 'Message', exact: true }).fill(`${unicodeBoundary}🏃`);
  await expect(member.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await expect(member.getByRole('alert')).toHaveText('Messages can be up to 2000 characters.');
  await member.getByRole('textbox', { name: 'Message', exact: true }).fill('');
  expect(await member.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await member.reload();
  await expect(member.getByRole('log', { name: 'Messages' }).getByText('مرحبا 🏃 — offline chat', { exact: true })).toHaveCount(1);
  await expect.poll(async () => (await json(request, member, 'get', '/notifications?limit=100')).items.filter(row => row.kind.startsWith('message.') && !row.read_at).length).toBe(0);
  expect((await json(request, page, 'get', '/messages?user_id=2')).filter(row => row.body === 'مرحبا 🏃 — offline chat')).toHaveLength(1);
});

test('chat paginates real history and restores access after reconnect while revoked group access fails closed', async ({ page, request, offlineContext }) => {
  test.setTimeout(60000);
  await signIn(page, 'owner');
  const member = await (await offlineContext()).newPage();
  await signIn(member, 'member');
  await friendship(request, page, member);
  for (let i = 0; i < 52; i++) await json(request, page, 'post', '/messages', { recipient_id: 2, body: `History ${String(i).padStart(2, '0')}`, client_request_id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}` }, 201);
  await member.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.__chatSockets = [];
    window.WebSocket = class extends NativeSocket {
      constructor(...args) { super(...args); window.__chatSockets.push(this); }
    };
  });
  await member.goto('/messages/direct/1');
  const log = member.getByRole('log', { name: 'Messages' });
  await expect(log.getByText('History 51', { exact: true })).toBeVisible();
  await expect(log.getByText('History 00', { exact: true })).toHaveCount(0);
  await member.getByRole('button', { name: 'Load earlier messages', exact: true }).click();
  await expect(log.getByText('History 00', { exact: true })).toHaveCount(1);
  await expect(member.getByRole('button', { name: 'Load earlier messages', exact: true })).toHaveCount(0);
  await expect.poll(() => member.evaluate(() => window.__chatSockets.some(socket => socket.url.includes('/api/v1/ws?') && socket.readyState === WebSocket.OPEN))).toBe(true);
  await member.context().setOffline(true);
  await member.evaluate(() => { for (const socket of window.__chatSockets) socket.close(4000, 'Offline recovery test'); });
  await json(request, page, 'post', '/messages', { recipient_id: 2, body: 'While disconnected', client_request_id: '00000000-0000-4000-8000-000000000100' }, 201);
  await expect(log.getByText('While disconnected', { exact: true })).toHaveCount(0);
  await member.context().setOffline(false);
  await expect(log.getByText('While disconnected', { exact: true })).toHaveCount(1);
  const accepted = await (await offlineContext()).newPage();
  await signIn(accepted, 'accepted');
  await accepted.goto('/messages/group/1');
  await expect(accepted.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
  await json(request, page, 'patch', '/groups/1/members/4', { status: 'removed' });
  await expect(accepted.getByRole('textbox', { name: 'Message', exact: true })).toHaveCount(0);
  await accepted.reload();
  await expect(accepted.getByRole('alert')).toBeVisible();
  expect((await request.get(`${api}/messages?group_id=1`, { headers: await headers(accepted) })).status()).toBe(403);
});

async function createCup(page, sport, name, count) {
  await page.goto('/cups/new');
  await page.getByLabel('Cup name', { exact: true }).fill(name);
  await page.getByRole('combobox', { name: /^Sport(?: required| ready)?$/ }).selectOption(String(sport));
  if (await page.getByRole('combobox', { name: /^Number of teams(?: required| ready)?$/ }).count()) await page.getByRole('combobox', { name: /^Number of teams(?: required| ready)?$/ }).selectOption(String(count));
  else await page.getByLabel('Number of teams (2–100)', { exact: true }).fill(String(count));
  await page.getByLabel('Players per team (roster limit)', { exact: true }).fill('5');
  await page.getByLabel('Rules', { exact: true }).fill('Respect opponents. Results are final.');
  const creation = page.waitForResponse(response => response.url().endsWith('/api/v1/cups') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create cup', exact: true }).click();
  expect((await creation).status()).toBe(201);
  await page.waitForURL('/cups');
  await page.getByRole('link', { name, exact: true }).click();
  await page.waitForURL(/\/cups\/\d+$/);
  return cupFromUrl(page);
}
async function registerTeams(page, request, id, sport, count, prefix) {
  await page.getByRole('button', { name: 'Open registration…', exact: true }).click();
  await page.getByLabel(/^Registration closes \(Bahrain time, optional\)/).fill(bahrainInput(1));
  await page.getByRole('button', { name: 'Open registration', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish cup', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish cup', exact: true })).toBeDisabled();
  for (let i = 1; i <= count; i++) {
    const group = await json(request, page, 'post', '/groups', { name: `${prefix} ${i}`, sports_id: sport }, 201);
    await page.reload();
    await page.getByRole('combobox', { name: /^Enter one of your groups(?: required| ready)?$/ }).selectOption(String(group.id));
    await page.getByRole('button', { name: 'Enter cup', exact: true }).click();
    const entry = page.locator('.entry-list li').filter({ has: page.locator('strong').filter({ hasText: `${prefix} ${i}` }) }).filter({ has: page.getByRole('button', { name: 'Accept', exact: true }) });
    await entry.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect.poll(async () => (await json(request, page, 'get', `/cups/${id}`)).entries.find(row => row.group_id === group.id)?.status).toBe('accepted');
  }
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Publish cup', exact: true }).click();
  await expect.poll(async () => (await json(request, page, 'get', `/cups/${id}`)).status).toBe('published');
}

test('knockout cup creates entries, publishes its bracket and records every round through completion', async ({ page, request }) => {
  test.setTimeout(60000);
  await signIn(page, 'owner');
  const id = await createCup(page, 1, 'Offline Knockout', 4);
  expect((await request.get(`${api}/cups/${id}`)).status()).toBe(404);
  await registerTeams(page, request, id, 1, 4, 'Knockout Team');
  for (let round = 0; round < 3; round++) {
    const fixture = page.locator('form.fixture-result').first();
    await expect(fixture).toBeVisible();
    await fixture.locator('input[type=number]').nth(0).fill('2');
    await fixture.locator('input[type=number]').nth(1).fill('1');
    await fixture.getByRole('button', { name: 'Save result', exact: true }).click();
    await expect.poll(async () => (await json(request, page, 'get', `/cups/${id}`)).fixtures.filter(row => row.winner_group_id != null).length).toBe(round + 1);
  }
  const saved = await json(request, page, 'get', `/cups/${id}`);
  expect(saved).toMatchObject({ status: 'completed', format: 'knockout' });
  expect(saved.fixtures).toHaveLength(3);
  expect(new Set(saved.fixtures.map(row => row.id)).size).toBe(3);
  await page.reload();
  await expect(page.locator('form.fixture-result')).toHaveCount(0);
  expect((await request.get(`${api}/cups/${id}`)).status()).toBe(200);
});

test('race cup records finish time and DNF without a bracket; draft deletion is confirmed and persisted', async ({ page, request }) => {
  test.setTimeout(60000);
  await signIn(page, 'owner');
  const id = await createCup(page, 4, 'Offline Race', 2);
  await registerTeams(page, request, id, 4, 2, 'Race Team');
  await page.getByLabel('Race Team 1 time', { exact: true }).fill('42:10');
  await page.getByLabel('Race Team 2 did not finish', { exact: true }).check();
  await page.getByRole('button', { name: 'Save results', exact: true }).click();
  await expect.poll(async () => (await json(request, page, 'get', `/cups/${id}`)).status).toBe('completed');
  const saved = await json(request, page, 'get', `/cups/${id}`);
  expect(saved.fixtures).toEqual([]);
  expect(saved.entries.find(row => row.group_name === 'Race Team 1')).toMatchObject({ finish_time_seconds: 2530, position: 1 });
  expect(saved.entries.find(row => row.group_name === 'Race Team 2').did_not_finish).toBe(true);
  const draft = await createCup(page, 1, 'Delete Draft', 4);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete cup', exact: true }).click();
  expect((await json(request, page, 'get', `/cups/${draft}`)).status).toBe('draft');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete cup', exact: true }).click();
  await page.waitForURL('/cups');
  expect((await request.get(`${api}/cups/${draft}`, { headers: await headers(page) })).status()).toBe(404);
});

for (const activity of [
  { name: 'Walking', outdoor: true, distance: '10', cupFormat: null },
  { name: 'Running', outdoor: true, distance: '10', cupFormat: 'race' },
  { name: 'Cycling', outdoor: true, distance: '25', cupFormat: 'race' },
  { name: 'Handball', outdoor: false, cupFormat: 'knockout' },
  { name: 'Padel', outdoor: false, cupFormat: 'knockout' },
  { name: 'Billiards', outdoor: false, cupFormat: 'knockout' },
  { name: 'Kayak', outdoor: true, distance: '5', cupFormat: 'race' },
]) {
  test(`new ${activity.name} supports rooms, discovery, groups and its cup eligibility`, async ({ page, request }) => {
    test.setTimeout(60000);
    const catalogResponse = await request.get(`${api}/sports`);
    expect(catalogResponse.status()).toBe(200);
    const catalog = await catalogResponse.json();
    expect(catalog.map(sport => sport.name).sort()).toEqual([
      'Basketball', 'Billiards', 'Cycling', 'Football', 'Handball', 'Kayak', 'Padel', 'Running', 'Swimming', 'Walking',
    ]);
    const sport = catalog.find(item => item.name === activity.name);
    expect(sport.formats).toBe(null);
    await signIn(page, 'owner');
    await page.goto('/rooms/new');
    await page.getByRole('combobox', { name: /^Sport(?: required| ready)?$/ }).selectOption(String(sport.id));
    await expect(page.getByRole('combobox', { name: /^Format(?: required| ready)?$/ })).toHaveCount(0);
    const capacity = page.getByLabel('Capacity (players)', { exact: true });
    await capacity.fill('0');
    await page.getByLabel('Title', { exact: true }).fill(`Offline ${activity.name}`);
    await page.getByLabel(/^Starts \(Bahrain time\)/).fill(bahrainInput(2));
    await page.getByLabel(/^Ends \(Bahrain time\)/).fill(bahrainInput(2.1));
    await page.getByRole('combobox', { name: /^Governorate(?: required| ready)?$/ }).selectOption('capital');
    await page.getByRole('combobox', { name: /^Area(?: required| ready)?$/ }).selectOption('Manama');
    await page.getByLabel('Location notes (optional)', { exact: true }).fill(`Private ${activity.name} meeting point`);
    if (activity.outdoor) {
      await page.getByLabel('Distance (km)', { exact: true }).fill(activity.distance);
      await page.getByLabel('Pace notes', { exact: true }).fill('Comfortable group pace');
      await page.getByLabel('Route notes', { exact: true }).fill('Park loop');
    } else {
      await expect(page.getByLabel('Distance (km)', { exact: true })).toHaveCount(0);
      await expect(page.getByLabel('Route notes', { exact: true })).toHaveCount(0);
    }
    const writes = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname === '/api/v1/rooms' && request.method() === 'POST') writes.push(request);
    });
    await page.getByRole('button', { name: 'Create room', exact: true }).click();
    expect(await capacity.evaluate(element => element.validity.rangeUnderflow)).toBe(true);
    expect(writes).toHaveLength(0);
    await capacity.fill('12');
    const creation = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/rooms' && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create room', exact: true }).click();
    const response = await creation;
    expect(response.status()).toBe(201);
    const room = await response.json();
    expect(writes).toHaveLength(1);
    await page.waitForURL(`/rooms/${room.id}`);
    await page.reload();
    await expect(page.getByRole('heading', { name: `Offline ${activity.name}`, exact: true })).toBeVisible();
    expect(await json(request, page, 'get', `/rooms/${room.id}`)).toMatchObject({
      sport_id: sport.id, capacity: 12, venue_notes: `Private ${activity.name} meeting point`,
      ...(activity.outdoor ? { distance_km: Number(activity.distance), pace_notes: 'Comfortable group pace', route_notes: 'Park loop' } : { distance_km: null }),
    });
    const publicRoom = await request.get(`${api}/rooms/${room.id}`);
    expect(publicRoom.status()).toBe(200);
    expect(await publicRoom.json()).not.toHaveProperty('venue_notes');
    await page.goto('/sports');
    await page.getByRole('combobox', { name: 'Activity', exact: true }).selectOption(String(sport.id));
    await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('sport_id') === String(sport.id));
    await expect(page.locator('.game-card')).toHaveCount(1);
    await expect(page.locator('.game-card')).toContainText(`Offline ${activity.name}`);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Activity', exact: true })).toHaveValue(String(sport.id));
    await expect(page.locator('.game-card')).toHaveCount(1);
    await page.goto('/groups');
    // Session restoration and the initial live connection can trigger a second
    // group load; finish it before activating a button that is disabled while loading.
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('button', { name: 'Test Owner', exact: true })).toBeVisible();
    await expect(banner.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Weekend Football', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Create group', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create group', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Group name', { exact: true }).fill(`${activity.name} Browser Group`);
    await dialog.getByRole('combobox', { name: /^Sport(?: required| ready)?$/ }).selectOption(String(sport.id));
    const groupCreation = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/groups' && response.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Create group', exact: true }).click();
    const groupResponse = await groupCreation;
    expect(groupResponse.status()).toBe(201);
    const group = await groupResponse.json();
    await expect(dialog.getByRole('status')).toHaveText(`${activity.name} Browser Group was created.`);
    expect(await json(request, page, 'get', `/groups/${group.id}`)).toMatchObject({ sports_id: sport.id, name: `${activity.name} Browser Group` });
    await page.goto('/groups');
    await page.getByRole('combobox', { name: 'Activity', exact: true }).selectOption(String(sport.id));
    await expect(page.locator('.group-card')).toHaveCount(1);
    await expect(page.locator('.group-card')).toContainText(`${activity.name} Browser Group`);
    await page.goto('/cups/new');
    const cupSport = page.getByRole('combobox', { name: /^Sport(?: required| ready)?$/ });
    if (activity.cupFormat) {
      await cupSport.selectOption(String(sport.id));
      await expect(page.getByText(`Format: ${activity.cupFormat === 'race' ? 'Race' : 'Knockout'}`, { exact: true })).toBeVisible();
      const id = await createCup(page, sport.id, `${activity.name} Browser Cup`, activity.cupFormat === 'race' ? 2 : 4);
      expect(await json(request, page, 'get', `/cups/${id}`)).toMatchObject({ sport_id: sport.id, format: activity.cupFormat, status: 'draft' });
      await page.reload();
      await expect(page.getByRole('heading', { name: `${activity.name} Browser Cup`, exact: true })).toBeVisible();
    } else {
      expect(await cupSport.locator('option').allTextContents()).not.toContain('Walking');
      const rejected = await request.post(`${api}/cups`, { headers: await headers(page), data: { name: 'Walking is not a cup sport', sport_id: sport.id, team_count: 2, roster_limit: 5, rules: 'Walking' } });
      expect(rejected.status()).toBe(400);
    }
  });
}
