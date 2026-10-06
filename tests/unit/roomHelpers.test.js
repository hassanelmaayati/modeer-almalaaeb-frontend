import { describe, expect, it } from 'vitest';
import { occupiedPlaces } from '../../src/lib/helpers/memberships';
import {
  buildRoomBody,
  isRoomFrozen,
  isStaleConflict,
  joinedMembershipLabel,
  roomDetailItems,
  roomErrors,
  scheduleError,
  withoutFrozenFields,
} from '../../src/lib/helpers/rooms';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const iso = (offset, now) => new Date(now + offset).toISOString();

const values = (changes = {}) => ({
  sport_id: '4',
  title: '  Friday game  ',
  description: '   ',
  difficulty: 'medium',
  starts_at: 'START',
  ends_at: 'END',
  capacity: '10',
  visibility: 'public',
  group_id: '',
  admission_policy: 'approval',
  district: 'capital',
  area: ' Juffair ',
  venue_location: null,
  venue_notes: '',
  notes: '',
  ...changes,
});

describe('buildRoomBody', () => {
  it('trims text, leaves out empty values and never sends server fields', () => {
    const { body } = buildRoomBody(values());
    expect(body).toEqual({
      sport_id: 4,
      title: 'Friday game',
      difficulty: 'medium',
      starts_at: 'START',
      ends_at: 'END',
      capacity: 10,
      visibility: 'public',
      admission_policy: 'approval',
      district: 'capital',
      area: 'Juffair',
    });
    expect(body).not.toHaveProperty('revision');
  });

  it('sends the pin, notes, group and distance when they are set', () => {
    const { body } = buildRoomBody(values({
      visibility: 'group',
      group_id: '3',
      venue_location: { latitude: 26.2, longitude: 50.6 },
      venue_notes: ' Court 2 ',
      notes: ' Bring water ',
      distance_km: '5.5',
    }));
    expect(body).toMatchObject({
      group_id: 3,
      venue_location: { latitude: 26.2, longitude: 50.6 },
      venue_notes: 'Court 2',
      notes: 'Bring water',
      distance_km: 5.5,
    });
  });

  it('sends the revision and clears emptied text only when editing', () => {
    const { body } = buildRoomBody(values({ description: '', notes: '' }), { editing: true, revision: 4 });
    expect(body).toMatchObject({ revision: 4, description: null, notes: null, venue_notes: null });
  });

  it('rejects a blank title, a blank area and a group room without a group', () => {
    expect(buildRoomBody(values({ title: ' ' })).error).toMatch(/title is required/i);
    expect(buildRoomBody(values({ area: ' ' })).error).toMatch(/choose an area/i);
    expect(buildRoomBody(values({ visibility: 'group' })).error).toMatch(/choose which group/i);
  });
});

describe('scheduleError', () => {
  const now = Date.now();
  const check = (start, end, options) => scheduleError(iso(start, now), iso(end, now), { now, ...options });

  it('accepts a start between one hour and fourteen days ahead', () => {
    expect(check(2 * HOUR, 3 * HOUR)).toBe('');
    expect(check(13 * 24 * HOUR, 13 * 24 * HOUR + HOUR)).toBe('');
  });

  it('rejects past, too soon and too far starts', () => {
    expect(check(-HOUR, HOUR)).toMatch(/start time cannot be in the past/);
    expect(check(30 * MINUTE, 2 * HOUR)).toMatch(/at least 1 hour from now/);
    expect(check(15 * 24 * HOUR, 15 * 24 * HOUR + HOUR)).toMatch(/within 14 days/);
  });

  it('rejects an end that is not after the start, or missing times', () => {
    expect(check(5 * HOUR, 4 * HOUR)).toMatch(/end time must be after the start time/);
    expect(scheduleError('', iso(HOUR, now), { now })).toMatch(/choose both a start and an end time/i);
  });

  it('skips the start window when the start is unchanged but still rejects a past end', () => {
    expect(check(10 * MINUTE, HOUR, { checkStart: false })).toBe('');
    expect(check(-2 * HOUR, -HOUR, { checkStart: false })).toMatch(/end time cannot be in the past/);
  });
});

describe('roomErrors', () => {
  const validation = (detail) => ({ status: 422, detail });

  it('maps backend rule messages to their fields and calls the area a governorate', () => {
    const result = roomErrors(validation([{ loc: ['body'], msg: "Value error, area 'Riffa' is not in the capital district" }]));
    expect(result.fields.area).toBe("area 'Riffa' is not in the capital governorate");
    expect(result.banner).toBe('Please fix the highlighted fields.');
  });

  it('maps messages by field path and by their leading words', () => {
    const cases = [
      [[{ loc: ['body', 'venue_location'], msg: 'Value error, venue_location must be inside Bahrain' }], 'venue_location'],
      [[{ loc: ['body', 'starts_at'], msg: 'Value error, must start at least 1 hour from now' }], 'starts_at'],
      [[{ loc: ['body'], msg: 'Value error, ends_at must be after starts_at' }], 'ends_at'],
      [[{ loc: ['body'], msg: "Value error, group_id is required when visibility is 'group'" }], 'group_id'],
      ['capacity 5 does not match any Football format (allowed: [10, 14, 22])', 'capacity'],
    ];
    for (const [detail, field] of cases) expect(Object.keys(roomErrors(validation(detail)).fields)).toEqual([field]);
  });

  it('shows network, server and conflict errors only in the banner', () => {
    for (const error of [{ status: 0, message: 'Unable to reach the server.' }, { status: 500, message: 'Request failed (500).' }, { status: 409, message: 'Room was changed' }]) {
      const result = roomErrors(error);
      expect(result.fields).toEqual({});
      expect(result.banner).toBe(error.message);
    }
  });
});

describe('frozen rooms', () => {
  const now = Date.now();

  it('freezes a room from fifteen minutes before its start', () => {
    const room = (offset) => ({ starts_at: iso(offset, now) });
    expect(isRoomFrozen(room(16 * MINUTE), now)).toBe(false);
    expect(isRoomFrozen(room(15 * MINUTE), now)).toBe(true);
    expect(isRoomFrozen(room(0), now)).toBe(true);
    expect(isRoomFrozen(room(-HOUR), now)).toBe(true);
    expect(isRoomFrozen({ starts_at: 'unreadable' }, now)).toBe(true);
  });

  it('removes the locked fields from a request body', () => {
    const body = {
      title: 'x',
      revision: 1,
      notes: 'n',
      difficulty: 'medium',
      capacity: 3,
      area: 'a',
      district: 'd',
      sport_id: 1,
      starts_at: 's',
      ends_at: 'e',
      venue_location: {},
      venue_notes: 'v',
    };
    expect(Object.keys(withoutFrozenFields(body)).sort()).toEqual(['difficulty', 'notes', 'revision', 'title']);
  });
});

describe('stale conflicts and membership labels', () => {
  it('treats a 409 as stale except the capacity conflict', () => {
    expect(isStaleConflict({ status: 409, message: 'Room was changed, reload it and try again' })).toBe(true);
    expect(isStaleConflict({ status: 409, message: 'Schedule, venue and capacity are frozen 15 minutes before the start' })).toBe(true);
    expect(isStaleConflict({ status: 409, message: 'Capacity cannot be lower than admitted players' })).toBe(false);
    expect(isStaleConflict({ status: 422, message: 'x' })).toBe(false);
    expect(isStaleConflict(undefined)).toBe(false);
  });

  it('labels each membership state', () => {
    expect(joinedMembershipLabel({ status: 'accepted' })).toBe('Accepted');
    expect(joinedMembershipLabel({ status: 'pending', requested: true })).toBe('Request pending');
    expect(joinedMembershipLabel({ status: 'pending', requested: false })).toBe('Invitation');
    expect(joinedMembershipLabel({ status: 'declined' })).toBe('Declined');
    expect(joinedMembershipLabel({ status: 'removed' })).toBe('Removed');
    expect(joinedMembershipLabel({ status: 'left' })).toBe('Left');
  });

  it('counts accepted players plus the host as taken places', () => {
    const members = [
      { user_id: 2, status: 'accepted' },
      { user_id: 3, status: 'accepted' },
      { user_id: 4, status: 'pending' },
      { user_id: 5, status: 'declined' },
    ];
    expect(occupiedPlaces({ host_id: 1 }, members)).toBe(3);
    expect(occupiedPlaces({ host_id: 1 }, [])).toBe(1);
    expect(occupiedPlaces({ host_id: 2 }, members)).toBe(2);
  });
});

describe('roomDetailItems', () => {
  const room = {
    status: 'open',
    difficulty: 'advanced',
    district: 'southern',
    area: 'Riffa',
    visibility: 'private',
    admission_policy: 'approval',
    capacity: 10,
    distance_km: 5.5,
    pace_notes: 'Easy pace',
    route_notes: 'Along the coast',
  };

  it('lists every public detail of a room with readable labels', () => {
    const items = roomDetailItems(room, { sportName: 'Running', hostName: 'Fatema' });
    expect(Object.fromEntries(items)).toEqual({
      Activity: 'Running',
      Status: 'Open',
      Difficulty: 'Advanced',
      Governorate: 'Southern',
      Area: 'Riffa',
      Visibility: 'Private',
      Joining: 'The host approves each request',
      Host: 'Fatema',
      Capacity: '10 places',
      Distance: '5.5 km',
      Pace: 'Easy pace',
      Route: 'Along the coast',
    });
  });

  it('leaves out details a room does not have', () => {
    const labels = roomDetailItems({ ...room, distance_km: null, pace_notes: null, route_notes: '', admission_policy: 'open' }).map(([label]) => label);
    expect(labels).not.toContain('Distance');
    expect(labels).not.toContain('Pace');
    expect(labels).not.toContain('Route');
    expect(labels).not.toContain('Activity');
    expect(labels).not.toContain('Host');
    expect(Object.fromEntries(roomDetailItems({ ...room, admission_policy: 'open' })).Joining).toBe('Anyone can join');
  });
});
