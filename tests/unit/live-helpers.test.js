import { describe, expect, it } from 'vitest';
import { targetQuery, targetBody, emptyConversation } from '../../src/services/messageService';
import { notificationDestination, roomEvent } from '../../src/lib/helpers/live';
import { roomPositions } from '../../src/lib/helpers/rooms';
import { getRoomAdmissionState } from '../../src/lib/helpers/memberships';

describe('message targets without chat UI', () => {
  it.each([['direct', 'user_id', 'recipient_id'], ['room', 'room_id', 'room_id'], ['group', 'group_id', 'group_id']])('maps %s reads and writes and supports an empty conversation', (type, readKey, writeKey) => {
    const target = { type, id: 3 };
    expect(targetQuery(target)).toEqual({ [readKey]: 3 });
    expect(targetBody(target, 'Hello', 'stable-id')).toEqual({ [writeKey]: 3, body: 'Hello', client_request_id: 'stable-id' });
    expect(emptyConversation(target, 'Team')).toEqual({ type, [readKey]: 3, title: 'Team', last_message: null });
  });
  it.each([{ type: 'cup', id: 1 }, { type: 'group', id: '../2' }, { type: 'room', id: 0 }])('rejects an invalid message target %o', target => {
    expect(() => targetQuery(target)).toThrow('Choose a valid message target.');
  });
});

describe('safe live discovery and navigation', () => {
  it('uses the server availability count when protected membership rows are hidden', () => {
    const room = { host_id: 1, capacity: 4, slots_left: 0, starts_at: '2030-10-10T15:00:00Z', status: 'open' };
    expect(getRoomAdmissionState(room, [], { id: 2 })).toMatchObject({ full: true, canRequest: false });
  });
  it('refreshes the affected room from public and private event shapes', () => {
    expect(roomEvent({ type: 'room_updated', room: { id: 2 } }, '2')).toBe(true);
    expect(roomEvent({ type: 'room.updated', room_id: 2 }, 3)).toBe(false);
    expect(roomEvent({ type: 'lobby.ready' }, 3)).toBe(true);
    expect(roomEvent({ type: 'message.created', message: { room_id: 3 } }, 3)).toBe(false);
  });
  it('never links a notification to an unimplemented view or arbitrary destination', () => {
    expect(notificationDestination({ target: { type: 'room', id: 3 } })).toBe('/rooms/3');
    expect(notificationDestination({ target: { type: 'group', id: 3 } })).toBe('/groups?group_id=3');
    expect(notificationDestination({ target: { type: 'direct', id: 3 } })).toBeNull();
    expect(notificationDestination({ target: { type: 'room', id: 'https://other.test' } })).toBeNull();
  });
  it('uses numeric places for legacy layouts and configured team identifiers otherwise', () => {
    expect(roomPositions({ capacity: 2, slot_layout: {} })).toEqual([{ value: '1', label: 'Place 1' }, { value: '2', label: 'Place 2' }]);
    expect(roomPositions({ capacity: 2, slot_layout: { teams: [{ slots: [{ id: 'A1', label: 'Keeper' }] }, { slots: ['B1'] }] } })).toEqual([{ value: 'A1', label: 'Keeper' }, { value: 'B1', label: 'B1' }]);
  });
});
