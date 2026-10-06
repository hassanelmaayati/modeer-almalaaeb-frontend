import { describe, expect, it } from 'vitest'
import { acceptedMemberCount, getRoomAdmissionState } from '../../src/lib/helpers/memberships.js'
import { formatActivityTime, formatActivitySchedule, parseDate, toBahrainDateTimeInput, fromBahrainDateTimeInput } from '../../src/lib/helpers/date.js'

const room = { host_id: 1, starts_at: '2026-10-10T15:00:00Z', status: 'open', capacity: 2 }
const player = { id: 2 }
const beforeCutoff = Date.parse('2026-10-10T14:44:59Z')

describe('activity admission guards', () => {
  it('accepts a signed-in non-host before the cutoff', () => {
    expect(getRoomAdmissionState(room, [], player, beforeCutoff).canRequest).toBe(true)
  })

  it('closes requests exactly fifteen minutes before the start', () => {
    const state = getRoomAdmissionState(room, [], player, Date.parse('2026-10-10T14:45:00Z'))
    expect(state).toMatchObject({ canRequest: false, atCutoff: true })
    expect(state.message).toMatch(/15 minutes/)
  })

  it('counts accepted memberships rather than pending or terminal records for capacity', () => {
    const members = [{ user_id: 3, status: 'pending' }, { user_id: 4, status: 'left' }, { user_id: 5, status: 'accepted' }]
    expect(acceptedMemberCount(members)).toBe(1)
    expect(getRoomAdmissionState(room, members, player, beforeCutoff).canRequest).toBe(true)
    members.push({ user_id: 6, status: 'accepted' })
    expect(getRoomAdmissionState(room, members, player, beforeCutoff)).toMatchObject({ full: true, canRequest: false })
  })

  it('allows withdrawal while a request is pending and blocks a duplicate request', () => {
    expect(getRoomAdmissionState(room, [{ user_id: 2, status: 'pending' }], player, beforeCutoff)).toMatchObject({ canRequest: false, canWithdraw: true })
  })

  it.each(['accepted', 'left', 'declined', 'removed'])('does not offer another request for an existing %s membership', (status) => {
    expect(getRoomAdmissionState(room, [{ user_id: 2, status }], player, beforeCutoff)).toMatchObject({ canRequest: false, canWithdraw: false })
  })

  it('prevents guests, hosts and closed activities from requesting places', () => {
    expect(getRoomAdmissionState(room, [], null, beforeCutoff).canRequest).toBe(false)
    expect(getRoomAdmissionState(room, [], { id: 1 }, beforeCutoff)).toMatchObject({ isHost: true, canRequest: false })
    expect(getRoomAdmissionState({ ...room, status: 'cancelled' }, [], player, beforeCutoff).canRequest).toBe(false)
  })
})

describe('Bahrain activity schedules', () => {
  it('treats naive backend timestamps as UTC and always displays Bahrain time', () => {
    expect(parseDate('2026-10-10T15:00:00').toISOString()).toBe('2026-10-10T15:00:00.000Z')
    expect(formatActivityTime('2026-10-10T15:00:00')).toBe('18:00')
    expect(toBahrainDateTimeInput('2026-10-10T15:00:00Z')).toBe('2026-10-10T18:00')
    expect(fromBahrainDateTimeInput('2026-10-10T18:00')).toBe('2026-10-10T15:00:00.000Z')
  })

  it('shows both Bahrain dates when an activity crosses midnight', () => {
    const schedule = formatActivitySchedule('2026-10-10T20:30:00Z', '2026-10-10T22:00:00Z')
    expect(schedule).toContain('10 Oct')
    expect(schedule).toContain('11 Oct')
    expect(schedule).toContain('23:30')
    expect(schedule).toContain('01:00')
  })

  it('keeps missing or invalid timestamps from rendering invalid dates', () => {
    expect(parseDate('invalid')).toBeNull()
    expect(formatActivitySchedule(null, 'invalid')).toBe('Schedule unavailable')
  })
})
