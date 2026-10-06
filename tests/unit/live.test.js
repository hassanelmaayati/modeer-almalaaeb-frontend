import { describe, expect, it } from 'vitest';
import { friendEvent, notificationDestination, personalRoomEvent } from '../../src/lib/helpers/live';

describe('friendEvent', () => {
  it('reacts to friendship changes and to the connection coming back', () => {
    expect(friendEvent({ type: 'friend.updated', direct_id: 3 })).toBe(true);
    expect(friendEvent({ type: 'connection.ready' })).toBe(true);
  });

  it('ignores everything else', () => {
    for (const type of ['room.updated', 'message.created', 'room_created', 'lobby.ready', 'notification.created']) expect(friendEvent({ type })).toBe(false);
  });
});

describe('personalRoomEvent', () => {
  it('still reacts to room updates and reconnects only', () => {
    expect(personalRoomEvent({ type: 'room.updated' })).toBe(true);
    expect(personalRoomEvent({ type: 'friend.updated' })).toBe(false);
  });
});

describe('notificationDestination', () => {
  const notification = (kind, type, id) => ({ kind, target: { type, id } });

  it('opens the requests tab for a friend request', () => {
    expect(notificationDestination(notification('friend.request', 'direct', 4))).toBe('/friends?tab=requests');
  });

  it('opens the friends page for any other friendship update', () => {
    expect(notificationDestination(notification('friend.updated', 'direct', 4))).toBe('/friends');
  });

  it('keeps the room and group destinations', () => {
    expect(notificationDestination(notification('room.updated', 'room', 12))).toBe('/rooms/12');
    expect(notificationDestination(notification('group.invitation', 'group', 3))).toBe('/groups?group_id=3');
  });

  it('opens the matching chat for a message notification', () => {
    expect(notificationDestination(notification('message.room', 'room', 12))).toBe('/messages/room/12');
    expect(notificationDestination(notification('message.group', 'group', 3))).toBe('/messages/group/3');
    expect(notificationDestination(notification('message.direct', 'direct', 4))).toBe('/messages/direct/4');
  });

  it('has no destination for other direct notifications or an invalid target', () => {
    expect(notificationDestination(notification('something.else', 'direct', 4))).toBeNull();
    expect(notificationDestination(notification('message.room', 'room', 0))).toBeNull();
    expect(notificationDestination({ kind: 'friend.request', target: { type: 'direct', id: 0 } })).toBeNull();
    expect(notificationDestination({ kind: 'x' })).toBeNull();
  });
});
