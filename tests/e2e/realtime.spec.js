import { test, expect } from '../helpers/offline.js';

const api = 'http://127.0.0.1:8001/api/v1';
const password = 'TestPass123!';
const auth = account => ({ Authorization: `Bearer ${account.token}` });

async function register(request, role) {
  const key = `rt_${role}_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`;
  const response = await request.post(`${api}/auth/signup`, { data: { user_name: key, email: `${key}@example.test`, password } });
  expect(response.status()).toBe(201);
  return response.json();
}

async function call(request, method, path, account, data, status = 200) {
  const response = await request[method](`${api}${path}`, { headers: auth(account), ...(data ? { data } : {}) });
  expect(response.status()).toBe(status);
  return status === 204 ? null : response.json();
}

async function track(page, account) {
  const urls = [];
  page.on('websocket', socket => urls.push(socket.url()));
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.__rtSockets = [];
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) { super(...args); window.__rtSockets.push(this); }
    };
  });
  await page.goto('/');
  await page.evaluate(async token => {
    const sockets = await import('/src/services/websocketService.js');
    const session = await import('/src/lib/helpers/session.js');
    window.__rtEvents = [];
    window.__rtStatuses = [];
    window.__rtOff = sockets.listen(event => window.__rtEvents.push(event));
    window.__rtStatusOff = sockets.watchStatus(value => window.__rtStatuses.push(value));
    session.setToken(token);
  }, account.token);
  await expect.poll(() => page.evaluate(() => window.__rtStatuses.at(-1))).toBe('connected');
  expect(urls.some(url => url.startsWith('ws://127.0.0.1:5174/api/v1/ws?ticket='))).toBe(true);
}

async function message(page, target, body, requestId = crypto.randomUUID()) {
  return page.evaluate(async ({ target, body, requestId }) => {
    const service = await import('/src/services/messageService.js');
    return service.create({ ...service.targetBody(target), body, client_request_id: requestId });
  }, { target, body, requestId });
}

async function received(page, id) {
  await expect.poll(() => page.evaluate(id => window.__rtEvents.filter(event => event.type === 'message.created' && event.message.id === id).length, id)).toBe(1);
}

async function history(page, target, existing = []) {
  return page.evaluate(async ({ target, existing }) => {
    const sockets = await import('/src/services/websocketService.js');
    return sockets.recoverMessages(target, existing);
  }, { target, existing });
}

async function peers(offlineContext, request) {
  const owner = await register(request, 'owner');
  const member = await register(request, 'member');
  const outsider = await register(request, 'outsider');
  const contexts = await Promise.all([offlineContext(), offlineContext(), offlineContext()]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  await Promise.all(pages.map((page, index) => track(page, [owner, member, outsider][index])));
  return { owner, member, outsider, contexts, pages };
}

test('real browser services deliver direct, private room and group chat through the Vite WebSocket proxy', async ({ offlineContext, request }) => {
  const fixture = await peers(offlineContext, request);
  const { owner, member, contexts, pages: [sender, recipient, outsider] } = fixture;
  try {
    await call(request, 'post', '/friends', owner, { other_user_id: member.user.id }, 201);
    await call(request, 'patch', `/friends/${owner.user.id}`, member, { status: 'accepted' });
    const group = await call(request, 'post', '/groups', owner, { name: 'Browser chat group', sports_id: 1 }, 201);
    await call(request, 'post', `/groups/${group.id}/members`, owner, { user_id: member.user.id }, 201);
    await call(request, 'patch', `/groups/${group.id}/members/${member.user.id}`, member, { status: 'accepted' });
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const room = await call(request, 'post', '/rooms', owner, { sport_id: 1, title: 'Private browser activity', capacity: 10, district: 'capital', area: 'Manama', visibility: 'private', starts_at: start.toISOString(), ends_at: new Date(+start + 3_600_000).toISOString() }, 201);
    await call(request, 'post', `/rooms/${room.id}/members`, owner, { user_id: member.user.id }, 201);
    await call(request, 'patch', `/rooms/${room.id}/members/${member.user.id}`, member, { status: 'accepted' });
    const targets = [{ type: 'direct', id: member.user.id }, { type: 'room', id: room.id }, { type: 'group', id: group.id }];
    for (const target of targets) {
      const body = `Browser ${target.type} message`;
      const requestId = crypto.randomUUID();
      const sent = await message(sender, target, body, requestId);
      await received(sender, sent.id);
      await received(recipient, sent.id);
      expect(await outsider.evaluate(id => window.__rtEvents.some(event => event.type === 'message.created' && event.message.id === id), sent.id)).toBe(false);
      const incomingTarget = target.type === 'direct' ? { type: 'direct', id: owner.user.id } : target;
      expect(await history(recipient, incomingTarget)).toEqual([sent]);
      const retry = await message(sender, target, body, requestId);
      expect(retry.id).toBe(sent.id);
      expect((await history(recipient, incomingTarget)).filter(item => item.id === sent.id)).toHaveLength(1);
    }
    const choices = await recipient.evaluate(async () => (await import('/src/services/messageService.js')).conversations({ include_empty: true }));
    expect(new Set(choices.map(choice => choice.type))).toEqual(new Set(['direct', 'group', 'room']));
    await call(request, 'patch', `/groups/${group.id}/members/${member.user.id}`, owner, { status: 'removed' });
    const revoked = await message(sender, { type: 'group', id: group.id }, 'After membership removal');
    await received(sender, revoked.id);
    expect(await recipient.evaluate(id => window.__rtEvents.some(event => event.type === 'message.created' && event.message.id === id), revoked.id)).toBe(false);
    const forbidden = await recipient.evaluate(async groupId => {
      try { await (await import('/src/services/messageService.js')).list({ group_id: groupId }); }
      catch (error) { return error.status; }
    }, group.id);
    expect(forbidden).toBe(403);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('browser reconnect recovers missed persisted messages and switching accounts isolates old sockets', async ({ offlineContext, request }) => {
  const fixture = await peers(offlineContext, request);
  const { owner, member, outsider, contexts, pages: [sender, recipient] } = fixture;
  try {
    await call(request, 'post', '/friends', owner, { other_user_id: member.user.id }, 201);
    await call(request, 'patch', `/friends/${owner.user.id}`, member, { status: 'accepted' });
    const outbound = { type: 'direct', id: member.user.id };
    const inbound = { type: 'direct', id: owner.user.id };
    const first = await message(sender, outbound, 'Before disconnect');
    await received(recipient, first.id);
    await contexts[1].setOffline(true);
    await recipient.evaluate(() => {
      for (const socket of window.__rtSockets) if (socket.url.includes('/api/v1/ws?')) socket.close(4000, 'Simulated connection loss');
    });
    await expect.poll(() => recipient.evaluate(() => window.__rtStatuses.at(-1))).toBe('reconnecting');
    const missed = await message(sender, outbound, 'While recipient is offline');
    await received(sender, missed.id);
    expect(await recipient.evaluate(id => window.__rtEvents.some(event => event.type === 'message.created' && event.message.id === id), missed.id)).toBe(false);
    await contexts[1].setOffline(false);
    await expect.poll(() => recipient.evaluate(() => window.__rtStatuses.at(-1))).toBe('connected');
    expect((await history(recipient, inbound, [first, first])).map(item => item.id)).toEqual([first.id, missed.id]);
    const fresh = await message(sender, outbound, 'After reconnect');
    await received(recipient, fresh.id);
    await recipient.evaluate(async token => {
      window.__rtEvents = [];
      (await import('/src/lib/helpers/session.js')).setToken(token);
    }, outsider.token);
    await expect(recipient.getByRole('button', { name: outsider.user.user_name, exact: true })).toBeVisible();
    await expect(recipient.getByRole('button', { name: member.user.user_name, exact: true })).toHaveCount(0);
    await expect.poll(() => recipient.evaluate(() => window.__rtStatuses.at(-1))).toBe('connected');
    const oldAccount = await message(sender, outbound, 'Only old account may receive this');
    await received(sender, oldAccount.id);
    expect(await recipient.evaluate(id => window.__rtEvents.some(event => event.type === 'message.created' && event.message.id === id), oldAccount.id)).toBe(false);
    expect(await history(recipient, inbound)).toEqual([]);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('notification service persists own unread state and the page updates from live invitation events', async ({ offlineContext, request }) => {
  const owner = await register(request, 'noticeowner');
  const member = await register(request, 'noticemember');
  const context = await offlineContext();
  const page = await context.newPage();
  try {
    await track(page, member);
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'No notifications yet', exact: true })).toBeVisible();
    const group = await call(request, 'post', '/groups', owner, { name: 'Notification destination group', sports_id: 1 }, 201);
    await call(request, 'post', `/groups/${group.id}/members`, owner, { user_id: member.user.id }, 201);
    await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toBeVisible();
    const before = await page.evaluate(async () => (await import('/src/services/notificationService.js')).list());
    expect(before.unread_count).toBe(1);
    expect(before.items[0].target).toEqual({ type: 'group', id: group.id });
    await page.getByRole('button', { name: 'Mark read', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toHaveCount(0);
    const after = await page.evaluate(async () => (await import('/src/services/notificationService.js')).list());
    expect(after.unread_count).toBe(0);
    expect(after.items[0].read_at).toBeTruthy();
    await page.getByRole('link', { name: 'Open details', exact: true }).click();
    await expect(page.getByRole('dialog', { name: group.name, exact: true })).toBeVisible();
    await page.evaluate(async () => (await import('/src/lib/helpers/session.js')).clearToken());
    await page.goto('/notifications');
    await expect(page.getByText('Sign in to see your notifications.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark all read', exact: true })).toHaveCount(0);
  } finally { await context.close(); }
});

test('public lobby events update discovery through the frontend proxy without a page reload', async ({ page, request }) => {
  const owner = await register(request, 'lobbyowner');
  await page.goto('/sports');
  const marker = 'same-public-document';
  await page.evaluate(value => { window.__lobbyTest = value; }, marker);
  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const room = await call(request, 'post', '/rooms', owner, { sport_id: 1, title: 'Live lobby browser room', capacity: 10, district: 'southern', area: 'Riffa', starts_at: start.toISOString(), ends_at: new Date(+start + 3_600_000).toISOString() }, 201);
  await expect(page.getByRole('heading', { name: room.title, exact: true })).toBeVisible();
  await call(request, 'post', `/rooms/${room.id}/cancel`, owner, { reason: 'Finished test' });
  await expect(page.getByRole('heading', { name: room.title, exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.__lobbyTest)).toBe(marker);
});
