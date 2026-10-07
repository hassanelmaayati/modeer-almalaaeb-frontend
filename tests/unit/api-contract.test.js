import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import ratings from '../../src/services/ratingService.js'
import { ApiError, WAKING_MESSAGE, request, requestPage, tooManyAttemptsMessage, watchServerWaking } from '../../src/lib/api/client.js'
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
  // Optional auth: signed-in users also receive group-only rooms of their groups.
  ['rooms', () => rooms.list({ sport_id: 1, district: 'capital' }), 'GET', '/rooms?sport_id=1&district=capital', true],
  ['rooms of a group, near a point', () => rooms.list({ group_id: 4, near_lat: 26.23, near_lng: 50.57, radius_km: 5, limit: 3 }), 'GET', '/rooms?group_id=4&near_lat=26.23&near_lng=50.57&radius_km=5&limit=3', true],
  ['transfer host', () => rooms.transferHost(1, 7), 'POST', '/rooms/1/transfer-host', true, { user_id: 7 }],
  ['my groups', () => groups.minePage({ limit: 20, offset: 40 }).then(() => ({ id: 1 })), 'GET', '/groups/mine?limit=20&offset=40', true],
  ['edit own message', () => messages.update(5, 'New text'), 'PATCH', '/messages/5', true, { body: 'New text' }],
  ['delete own message', () => messages.remove(5), 'DELETE', '/messages/5', true],
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
  ['rate a player', () => ratings.give(1, { user_id: 2, stars: 5 }), 'POST', '/rooms/1/ratings', true, { user_id: 2, stars: 5 }],
  ['my ratings in a room', () => ratings.listMine(1), 'GET', '/rooms/1/ratings/mine', true],
  ['public user rating', () => ratings.getForUser(2), 'GET', '/users/2/rating', false],
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

  it('looks users up by id, at most 100 per call, without duplicates', async () => {
    const people = ids => ids.map(id => ({ id, user_name: `User ${id}` }))
    fetch.mockImplementation(async url => jsonResponse(people(new URL(url, 'http://x').searchParams.get('ids').split(',').map(Number))))
    const ids = Array.from({ length: 150 }, (_, index) => index + 1)
    expect(await users.listByIds([...ids, 3, 4, 'x', -1, 0])).toHaveLength(150)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(new URL(fetch.mock.calls[0][0], 'http://x').searchParams.get('ids').split(',')).toHaveLength(100)
    expect(new URL(fetch.mock.calls[1][0], 'http://x').searchParams.get('ids').split(',')).toHaveLength(50)
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
    fetch.mockClear()
    expect(await users.listByIds([])).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses the server filter when it works, and scans the user list itself when the server ignores ?search=', async () => {
    fetch.mockImplementationOnce(async () => jsonResponse([{ id: 1, user_name: 'Sara' }, { id: 2, user_name: 'Sarah Ali' }]))
    expect((await users.search('sara')).map(user => user.id)).toEqual([1, 2])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(new URL(fetch.mock.calls[0][0], 'http://x').searchParams.get('search')).toBe('sara')
    fetch.mockClear()
    // An unfiltered answer (the live API ignores ?search= today) is not trusted: filter it, and keep paging until the end.
    const everyone = Array.from({ length: 100 }, (_, index) => ({ id: index + 1, user_name: index === 99 ? 'Omar' : `Player ${index}` }))
    fetch.mockImplementationOnce(async () => jsonResponse(everyone)).mockImplementationOnce(async () => jsonResponse([{ id: 101, user_name: 'Omar Two' }]))
    expect((await users.search('OMAR')).map(user => user.user_name)).toEqual(['Omar', 'Omar Two'])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(new URL(fetch.mock.calls[1][0], 'http://x').searchParams.get('offset')).toBe('100')
    fetch.mockClear()
    expect(await users.search('   ')).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads the X-Total-Count header of a paged list, or null when it is missing', async () => {
    fetch.mockImplementationOnce(async () => new Response('[{"id":1}]', { status: 200, headers: { 'X-Total-Count': '42' } }))
    expect(await requestPage('rooms', { query: { limit: 1 } })).toEqual({ items: [{ id: 1 }], total: 42 })
    fetch.mockImplementationOnce(async () => jsonResponse([{ id: 1 }]))
    expect(await requestPage('rooms')).toEqual({ items: [{ id: 1 }], total: null })
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

  it('cancels the network request when the caller aborts', async () => {
    const controller = new AbortController()
    fetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))))
    const pending = sports.list({ signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetch).toHaveBeenCalledTimes(1)
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

  describe('a slow or sleeping backend', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('retries a GET once, then says the server is waking up without leaking network internals', async () => {
      fetch.mockRejectedValue(new TypeError('Connection refused'))
      const result = sports.list().catch(error => error)
      await vi.advanceTimersByTimeAsync(2_000)
      const error = await result
      expect(error).toBeInstanceOf(ApiError)
      expect(error.message).toBe(WAKING_MESSAGE)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('recovers when the retry succeeds', async () => {
      fetch.mockRejectedValueOnce(new TypeError('Connection refused')).mockResolvedValueOnce(jsonResponse([{ id: 1 }]))
      const result = sports.list()
      await vi.advanceTimersByTimeAsync(2_000)
      await expect(result).resolves.toEqual([{ id: 1 }])
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('retries a GET once when the host answers 503 while starting', async () => {
      fetch.mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(jsonResponse([{ id: 2 }]))
      const result = sports.list()
      await vi.advanceTimersByTimeAsync(2_000)
      await expect(result).resolves.toEqual([{ id: 2 }])
    })

    it('never retries a write', async () => {
      setToken(token())
      fetch.mockRejectedValue(new TypeError('Connection refused'))
      await expect(rooms.cancel(1, 'Rain')).rejects.toMatchObject({ message: WAKING_MESSAGE })
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('gives up on a request that never answers after 20 seconds, and retries a GET once', async () => {
      fetch.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))))
      const result = sports.list().catch(error => error)
      await vi.advanceTimersByTimeAsync(20_000)
      expect(fetch).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1_000 + 20_000)
      expect((await result).message).toBe(WAKING_MESSAGE)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('tells the app when requests are slow and when the server answers again', async () => {
      const seen = []
      const stop = watchServerWaking(value => seen.push(value))
      let answer
      fetch.mockImplementationOnce(() => new Promise(resolve => { answer = () => resolve(jsonResponse([])) }))
      const result = sports.list()
      await vi.advanceTimersByTimeAsync(7_000)
      expect(seen.at(-1)).toBe(true)
      answer()
      await result
      expect(seen.at(-1)).toBe(false)
      stop()
    })
  })

  describe('rate limits and size limits', () => {
    it.each([[120, 'Too many attempts, try again in 2 minutes.'], [30, 'Too many attempts, try again in 1 minute.'], [61, 'Too many attempts, try again in 2 minutes.']])('turns a 429 with Retry-After %s s into "%s"', async (seconds, message) => {
      fetch.mockResolvedValue(new Response(JSON.stringify({ detail: 'Rate limit exceeded' }), { status: 429, headers: { 'Retry-After': String(seconds) } }))
      await expect(auth.signIn({ email: 'a@example.test', password: 'wrong' })).rejects.toMatchObject({ status: 429, message, retryAfter: seconds })
    })
    it('still explains a 429 when the browser cannot read Retry-After (it is not CORS-exposed)', async () => {
      fetch.mockResolvedValue(new Response('{"detail":"slow down"}', { status: 429 }))
      await expect(auth.signIn({ email: 'a@example.test', password: 'wrong' })).rejects.toMatchObject({ status: 429, message: tooManyAttemptsMessage(null) })
      expect(tooManyAttemptsMessage(null)).toBe('Too many attempts, please try again in a few minutes.')
    })
    it('explains a 413 clearly instead of showing the raw detail', async () => {
      setToken(token())
      fetch.mockResolvedValue(new Response('{"detail":"Request Entity Too Large"}', { status: 413 }))
      await expect(rooms.cancel(1, 'x'.repeat(10))).rejects.toMatchObject({ status: 413, message: 'That is too large to send. Make it shorter or smaller and try again.' })
    })
    it('keeps the backend detail for a 404', async () => {
      fetch.mockResolvedValue(new Response('{"detail":"Room not found"}', { status: 404 }))
      await expect(rooms.get(99)).rejects.toMatchObject({ status: 404, message: 'Room not found' })
    })
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
