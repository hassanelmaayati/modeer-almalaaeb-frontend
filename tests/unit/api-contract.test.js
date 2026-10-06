import { beforeEach, describe, expect, it, vi } from 'vitest'
import auth from '../../src/services/authService.js'
import users from '../../src/services/userService.js'
import sports from '../../src/services/sportService.js'
import groups from '../../src/services/groupService.js'
import groupMembers from '../../src/services/groupMemberService.js'
import rooms from '../../src/services/roomService.js'
import roomMembers from '../../src/services/roomMemberService.js'
import friends from '../../src/services/friendService.js'
import messages from '../../src/services/messageService.js'
import cups from '../../src/services/cupService.js'
import cupRoster from '../../src/services/cupRosterService.js'
import notifications from '../../src/services/notificationService.js'
import google from '../../src/services/googleAuthService.js'
import { ApiError, request } from '../../src/lib/api/client.js'
import { clearToken, getToken, setToken } from '../../src/lib/helpers/session.js'

const token = () => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: '1', exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const payload = { name: 'Evening team', sports_id: 1 }

// This matrix records the final backend contract, including its PUT/PATCH distinctions.
const contracts = [
  ['signup', () => auth.signUp({ user_name: 'Player', email: 'player@example.test', password: 'TestPass123!' }), 'POST', '/auth/signup', false, { user_name: 'Player', email: 'player@example.test', password: 'TestPass123!' }],
  ['login', () => auth.signIn({ email: 'owner@example.test', password: 'TestPass123!' }), 'POST', '/auth/login', false, { email: 'owner@example.test', password: 'TestPass123!' }],
  ['logout', () => auth.logout(), 'POST', '/auth/logout', true],
  ['Google sign in', () => google.signIn({ credential: 'id-token' }), 'POST', '/auth/google', false, { credential: 'id-token' }],
  ['link Google', () => google.link({ credential: 'id-token' }), 'POST', '/auth/google/link', true, { credential: 'id-token' }],
  ['user profile', () => users.get(2), 'GET', '/users/2', false],
  ['current user', () => users.getMe(), 'GET', '/users/me', true],
  ['update current user', () => users.updateMe({ user_name: 'Player' }), 'PUT', '/users/me', true, { user_name: 'Player' }],
  ['sports', () => sports.list(), 'GET', '/sports', false],
  ['sport', () => sports.get(1), 'GET', '/sports/1', false],
  ['groups', () => groups.list(), 'GET', '/groups', false],
  ['group', () => groups.get(1), 'GET', '/groups/1', false],
  ['create group', () => groups.create(payload), 'POST', '/groups', true, payload],
  ['edit group', () => groups.update(1, { name: 'New name' }), 'PUT', '/groups/1', true, { name: 'New name' }],
  ['group members', () => groupMembers.list(1), 'GET', '/groups/1/members', true],
  ['invite group member', () => groupMembers.invite(1, 2), 'POST', '/groups/1/members', true, { user_id: 2 }],
  ['accept group invitation', () => groupMembers.update(1, 2, { status: 'accepted' }), 'PATCH', '/groups/1/members/2', true, { status: 'accepted' }],
  ['rooms', () => rooms.list({ sport_id: 1, district: 'capital' }), 'GET', '/rooms?sport_id=1&district=capital', false],
  ['hosted room pages', () => rooms.listMine({ status: ['open', 'started'], limit: 20, offset: 20 }), 'GET', '/rooms/mine?status=open&status=started&limit=20&offset=20', true],
  ['joined room pages', () => rooms.listJoined({ membership: ['accepted', 'pending'], requested: false }), 'GET', '/rooms/joined?membership=accepted&membership=pending&requested=false', true],
  ['room detail', () => rooms.get(1), 'GET', '/rooms/1', true],
  ['create room', () => rooms.create({ title: 'Match', sport_id: 1 }), 'POST', '/rooms', true, { title: 'Match', sport_id: 1 }],
  ['edit room', () => rooms.update(1, { revision: 0, title: 'New match' }), 'PUT', '/rooms/1', true, { revision: 0, title: 'New match' }],
  ['cancel room', () => rooms.cancel(1, 'Rain'), 'POST', '/rooms/1/cancel', true, { reason: 'Rain' }],
  ['room members', () => roomMembers.list(1), 'GET', '/rooms/1/members', true],
  ['request place', () => roomMembers.request(1), 'POST', '/rooms/1/members', true, {}],
  ['invite room member', () => roomMembers.invite(1, 2), 'POST', '/rooms/1/members', true, { user_id: 2 }],
  ['edit room member', () => roomMembers.update(1, 2, { status: 'accepted' }), 'PATCH', '/rooms/1/members/2', true, { status: 'accepted' }],
  ['withdraw room request', () => roomMembers.leave(1), 'DELETE', '/rooms/1/members/me', true],
  ['friends', () => friends.list(), 'GET', '/friends', true],
  ['request friendship', () => friends.create({ other_user_id: 2 }), 'POST', '/friends', true, { other_user_id: 2 }],
  ['accept friendship', () => friends.update(2, { status: 'accepted' }), 'PATCH', '/friends/2', true, { status: 'accepted' }],
  ['messages', () => messages.list({ room_id: 1 }), 'GET', '/messages?room_id=1', true],
  ['conversations', () => messages.conversations({ limit: 20 }), 'GET', '/messages/conversations?limit=20', true],
  ['empty conversations', () => messages.conversations({ include_empty: true }), 'GET', '/messages/conversations?include_empty=true', true],
  ['send message', () => messages.create({ room_id: 1, body: 'Hello', client_request_id: '2ce22db3-8003-4f1a-a570-0f925450a214' }), 'POST', '/messages', true, { room_id: 1, body: 'Hello', client_request_id: '2ce22db3-8003-4f1a-a570-0f925450a214' }],
  ['group messages', () => messages.list({ group_id: 2, before: 40, limit: 100 }), 'GET', '/messages?group_id=2&before=40&limit=100', true],
  ['group message', () => messages.create(messages.targetBody({ type: 'group', id: 2 }, 'Hello', '2ce22db3-8003-4f1a-a570-0f925450a214')), 'POST', '/messages', true, { group_id: 2, body: 'Hello', client_request_id: '2ce22db3-8003-4f1a-a570-0f925450a214' }],
  ['notifications', () => notifications.list({ before: 10, limit: 50, unread_only: true }), 'GET', '/notifications?before=10&limit=50&unread_only=true', true],
  ['read notification', () => notifications.markRead(3), 'PATCH', '/notifications/3', true, { read: true }],
  ['read all notifications', () => notifications.markAllRead(), 'PATCH', '/notifications', true, { read: true }],
  ['cups', () => cups.list({ status: 'published' }), 'GET', '/cups?status=published', true],
  ['cup pages', () => cups.list({ status: 'registration', limit: 50, offset: 50 }), 'GET', '/cups?status=registration&limit=50&offset=50', true],
  ['cup roster', () => cupRoster.list(1), 'GET', '/cups/1/roster', true],
  ['cup', () => cups.get(1), 'GET', '/cups/1', true],
  ['create cup', () => cups.create({ name: 'Cup' }), 'POST', '/cups', true, { name: 'Cup' }],
  ['edit cup', () => cups.update(1, { revision: 0 }), 'PATCH', '/cups/1', true, { revision: 0 }],
  ['delete cup', () => cups.remove(1), 'DELETE', '/cups/1', true],
  ['enter cup', () => cups.createEntry(1, { group_id: 2 }), 'POST', '/cups/1/entries', true, { group_id: 2 }],
  ['edit cup entry', () => cups.updateEntry(1, 2, { revision: 0 }), 'PUT', '/cups/1/entries/2', true, { revision: 0 }],
  ['invite cup player', () => cupRoster.invite(1, { user_id: 2, group_id: 1 }), 'POST', '/cups/1/roster', true, { user_id: 2, group_id: 1 }],
  ['accept cup invitation', () => cupRoster.update(1, 2, { status: 'accepted' }), 'PATCH', '/cups/1/roster/2', true, { status: 'accepted' }],
]

beforeEach(() => {
  clearToken()
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => jsonResponse({ id: 1 })))
})

describe('backend service contracts', () => {
  it.each(contracts)('%s sends the documented method, URL, body and authentication', async (_name, invoke, method, path, authenticated, body) => {
    const session = token()
    setToken(session)
    const data = await invoke()
    expect(data).toEqual({ id: 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(`/api/v1${path}`)
    expect(options.method).toBe(method)
    expect(options.headers.Authorization).toBe(authenticated ? `Bearer ${session}` : undefined)
    if (body !== undefined) {
      expect(JSON.parse(options.body)).toEqual(body)
      expect(options.headers['Content-Type']).toBe('application/json')
    } else {
      expect(options.body).toBeUndefined()
    }
  })

  it('reads every page of the paged user list for search and name lookups', async () => {
    const people = count => Array.from({ length: count }, (_, index) => ({ id: index + 1 }))
    fetch.mockImplementationOnce(async () => jsonResponse(people(100))).mockImplementationOnce(async () => jsonResponse(people(3)))
    expect(await users.list()).toHaveLength(103)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/v1/users?limit=100&offset=0', '/api/v1/users?limit=100&offset=100'])
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('allows public room and cup details when signed out', async () => {
    await rooms.get(1)
    await roomMembers.list(1)
    await cups.get(1)
    await cups.list()
    await cupRoster.list(1)
    expect(fetch).toHaveBeenCalledTimes(5)
    for (const [, options] of fetch.mock.calls) expect(options.headers.Authorization).toBeUndefined()
  })

  it('encodes identifiers so they cannot change the selected resource URL', async () => {
    await rooms.get('../users?admin=true')
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/rooms/..%2Fusers%3Fadmin%3Dtrue')
  })

  it('does not clear a new account when an old account request returns unauthorized', async () => {
    const old = token()
    setToken(old)
    let resolve
    fetch.mockImplementationOnce(() => new Promise(yes => { resolve = yes }))
    const pending = users.getMe()
    const fresh = old.replace('.signature', '.different-signature')
    setToken(fresh)
    resolve(jsonResponse({ detail: 'Old session revoked' }, 401))
    await expect(pending).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBe(fresh)
  })

  it('blocks protected actions locally without a session', async () => {
    await expect(groups.create(payload)).rejects.toMatchObject({ status: 401 })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('forwards cancellation signals to the network request', async () => {
    const controller = new AbortController()
    await sports.list({ signal: controller.signal })
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal)
  })
})

describe('API response and failure handling', () => {
  it('returns null for a 204 response without parsing JSON', async () => {
    setToken(token())
    fetch.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(roomMembers.leave(1)).resolves.toBeNull()
  })

  it('preserves FastAPI validation fields for accessible form errors', async () => {
    fetch.mockResolvedValue(jsonResponse({ detail: [{ loc: ['body', 'user_name'], msg: 'String should have at least 3 characters' }] }, 422))
    await expect(auth.signUp({})).rejects.toMatchObject({ status: 422, fieldErrors: { user_name: 'String should have at least 3 characters' } })
  })

  it('clears a rejected session and returns backend error text', async () => {
    setToken(token())
    fetch.mockResolvedValue(jsonResponse({ detail: 'Token has expired' }, 401))
    await expect(users.getMe()).rejects.toMatchObject({ status: 401, message: 'Token has expired' })
    expect(getToken()).toBeNull()
  })

  it('treats wrong login credentials (401) as a form error without touching any stored session', async () => {
    const session = token()
    setToken(session)
    fetch.mockResolvedValue(jsonResponse({ detail: 'Invalid credentials' }, 401))
    await expect(auth.signIn({ email: 'a@example.test', password: 'wrong' })).rejects.toMatchObject({ status: 401, message: 'Invalid credentials' })
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
    expect(getToken()).toBe(session)
  })

  it('preserves AbortError rather than displaying a server failure', async () => {
    const aborted = new DOMException('Aborted', 'AbortError')
    fetch.mockRejectedValue(aborted)
    await expect(sports.list()).rejects.toBe(aborted)
  })

  it('reports an unavailable backend without leaking network internals or retrying', async () => {
    fetch.mockRejectedValue(new TypeError('Connection refused'))
    await expect(sports.list()).rejects.toBeInstanceOf(ApiError)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('omits unset filters and serializes dates as timezone-aware ISO strings', async () => {
    await rooms.list({ sport_id: 1, difficulty: '', district: null, starts_from: new Date('2026-10-05T18:00:00+03:00'), starts_to: undefined })
    const url = new URL(fetch.mock.calls[0][0], 'http://localhost')
    expect(Object.fromEntries(url.searchParams)).toEqual({ sport_id: '1', starts_from: '2026-10-05T15:00:00.000Z' })
  })

  it('reports malformed successful JSON instead of rendering undefined data', async () => {
    fetch.mockResolvedValue(new Response('<html>wrong server</html>', { status: 200 }))
    await expect(request('sports')).rejects.toMatchObject({ status: 200, message: 'The server returned an unreadable response.' })
  })
})
