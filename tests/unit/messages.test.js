import { describe, expect, it } from 'vitest';
import {
  applyMessage,
  chatDestination,
  chatTitle,
  chatKey,
  chatPath,
  conversationKey,
  conversationPath,
  conversationTarget,
  filterConversations,
  formatDayLabel,
  formatMessageTime,
  formatConversationTime,
  groupMessagesByDay,
  isSystemMessage,
  mergeById,
  messageDay,
  messageConversationKey,
  messagePreview,
  parseChatTarget,
  receiveMessage,
  sendBlockReason,
  sortConversations,
  threadErrorMessage,
  validateMessageBody,
} from '../../src/lib/helpers/messages';

describe('parseChatTarget', () => {
  it('returns nothing when no chat is open', () => {
    expect(parseChatTarget({})).toBeNull();
  });

  it('reads a room, group or direct chat and turns the id into a number', () => {
    expect(parseChatTarget({ type: 'room', id: '12' })).toEqual({ type: 'room', id: 12 });
    expect(parseChatTarget({ type: 'group', id: '3' })).toEqual({ type: 'group', id: 3 });
    expect(parseChatTarget({ type: 'direct', id: '8' })).toEqual({ type: 'direct', id: 8 });
  });

  it('marks an unknown type or a bad id as invalid', () => {
    for (const params of [
      { type: 'channel', id: '1' },
      { type: 'room', id: '0' },
      { type: 'room', id: '-4' },
      { type: 'room', id: 'abc' },
      { type: 'room', id: '1.5' },
      { type: 'room' },
      { id: '1' },
    ]) expect(parseChatTarget(params)).toEqual({ invalid: true });
  });
});

describe('chat identifiers', () => {
  it('builds the path and the key of a chat', () => {
    expect(chatPath('room', 12)).toBe('/messages/room/12');
    expect(chatPath('direct', 8)).toBe('/messages/direct/8');
    expect(chatKey('group', 3)).toBe('group:3');
  });
});

describe('conversation helpers', () => {
  const room = (id, last = null, title = 'Room') => ({ type: 'room', room_id: id, title, last_message: last });
  const direct = (id, last = null, title = 'Sara') => ({ type: 'direct', user_id: id, title, last_message: last });
  const group = (id, last = null, title = 'Group') => ({ type: 'group', group_id: id, title, last_message: last });
  const msg = (id, extra = {}) => ({ id, sender_id: 7, recipient_id: null, room_id: null, group_id: null, type: 'room', body: 'Hi', created_at: '2026-10-06T12:00:00Z', ...extra });

  it('finds the target, key and path of a conversation', () => {
    expect(conversationTarget(room(3))).toEqual({ type: 'room', id: 3 });
    expect(conversationTarget(group(2))).toEqual({ type: 'group', id: 2 });
    expect(conversationTarget(direct(8))).toEqual({ type: 'direct', id: 8 });
    expect(conversationKey(direct(8))).toBe('direct:8');
    expect(conversationPath(room(3))).toBe('/messages/room/3');
  });

  it('recognises system messages', () => {
    expect(isSystemMessage(msg(1, { type: 'system', sender_id: null }))).toBe(true);
    expect(isSystemMessage(msg(1, { sender_id: null }))).toBe(true);
    expect(isSystemMessage(msg(1))).toBe(false);
  });

  it('builds the preview for each kind of last message', () => {
    const nameOf = (id) => `User${id}`;
    expect(messagePreview(room(1), 1, nameOf)).toBeNull();
    expect(messagePreview(room(1, msg(1, { sender_id: null, type: 'system', body: 'Room cancelled: Rain' })), 1, nameOf)).toEqual({ text: 'Room cancelled: Rain', system: true });
    expect(messagePreview(room(1, msg(1, { sender_id: 1 })), 1, nameOf)).toEqual({ text: 'You: Hi', system: false });
    expect(messagePreview(room(1, msg(1, { sender_id: 7 })), 1, nameOf)).toEqual({ text: 'User7: Hi', system: false });
    expect(messagePreview(group(1, msg(1, { sender_id: 7, type: 'group' })), 1, nameOf)).toEqual({ text: 'User7: Hi', system: false });
    expect(messagePreview(direct(7, msg(1, { sender_id: 7, type: 'direct' })), 1, nameOf)).toEqual({ text: 'Hi', system: false });
  });

  it('formats the time like a messaging app, in Bahrain time', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    expect(formatConversationTime('2026-10-06T08:05:00Z', now)).toBe('11:05');
    expect(formatConversationTime('2026-10-05T20:00:00Z', now)).toBe('Yesterday');
    expect(formatConversationTime('2026-10-03T09:00:00Z', now)).toBe('Saturday');
    expect(formatConversationTime('2026-09-20T09:00:00Z', now)).toBe('20/09/2026');
    expect(formatConversationTime(null, now)).toBe('');
    expect(formatConversationTime('nonsense', now)).toBe('');
  });

  it('counts a message just after midnight in Bahrain as the next day', () => {
    const now = new Date('2026-10-06T10:00:00Z');
    expect(formatConversationTime('2026-10-05T21:30:00Z', now)).toBe('00:30');
    expect(formatConversationTime('2026-10-05T20:30:00Z', now)).toBe('Yesterday');
  });

  it('sorts newest first and keeps empty chats last in their order', () => {
    const sorted = sortConversations([room(1, null, 'A'), room(2, msg(5), 'B'), room(3, null, 'C'), room(4, msg(9), 'D')]);
    expect(sorted.map((item) => item.title)).toEqual(['D', 'B', 'A', 'C']);
  });

  it('filters by type and by part of the title', () => {
    const all = [room(1, null, 'Friday game'), group(2, null, 'Runners'), direct(3, null, 'Sara')];
    expect(filterConversations(all, { type: 'room' }).map((item) => item.title)).toEqual(['Friday game']);
    expect(filterConversations(all, { query: ' RUN ' }).map((item) => item.title)).toEqual(['Runners']);
    expect(filterConversations(all, { type: 'direct', query: 'run' })).toEqual([]);
    expect(filterConversations(all)).toHaveLength(3);
  });

  it('finds which chat a message belongs to', () => {
    expect(messageConversationKey(msg(1, { room_id: 3 }), 1)).toBe('room:3');
    expect(messageConversationKey(msg(1, { group_id: 2, type: 'group' }), 1)).toBe('group:2');
    expect(messageConversationKey(msg(1, { sender_id: 8, recipient_id: 1, type: 'direct' }), 1)).toBe('direct:8');
    expect(messageConversationKey(msg(1, { sender_id: 1, recipient_id: 8, type: 'direct' }), 1)).toBe('direct:8');
  });

  it('puts a new message on its chat and moves it to the top', () => {
    const list = [room(1, msg(5), 'A'), room(2, msg(9), 'B'), direct(8, null, 'Sara')];
    const result = applyMessage(list, msg(20, { room_id: 1 }), 1);
    expect(result.map((item) => item.title)).toEqual(['A', 'B', 'Sara']);
    expect(result[0].last_message.id).toBe(20);
    const first = applyMessage(list, msg(21, { sender_id: 1, recipient_id: 8, type: 'direct' }), 1);
    expect(first[0].title).toBe('Sara');
  });

  it('leaves the list alone for an older message and asks for a reload for an unknown chat', () => {
    const list = [room(1, msg(5), 'A')];
    expect(applyMessage(list, msg(3, { room_id: 1 }), 1)).toBe(list);
    expect(applyMessage(list, msg(30, { room_id: 99 }), 1)).toBeNull();
  });
});

describe('thread helpers', () => {
  it('formats the time of a message in Bahrain time', () => {
    expect(formatMessageTime('2026-10-06T08:05:00Z')).toBe('11:05');
    expect(formatMessageTime('2026-10-06T08:05:00')).toBe('11:05');
    expect(formatMessageTime('2026-10-06T23:30:00Z')).toBe('02:30');
    expect(formatMessageTime(null)).toBe('');
    expect(formatMessageTime('nonsense')).toBe('');
  });

  it('gives each message the day it was sent in Bahrain', () => {
    expect(messageDay('2026-10-06T08:05:00Z')).toBe('2026-10-06');
    expect(messageDay('2026-10-05T21:30:00Z')).toBe('2026-10-06');
    expect(messageDay(null)).toBe('');
  });

  it('labels a day like a messaging app', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    expect(formatDayLabel('2026-10-06', now)).toBe('Today');
    expect(formatDayLabel('2026-10-05', now)).toBe('Yesterday');
    expect(formatDayLabel('2026-10-03', now)).toBe('Saturday');
    expect(formatDayLabel('2026-09-20', now)).toBe('20 Sept 2026');
    expect(formatDayLabel('', now)).toBe('');
  });

  it('groups messages by day, keeping their order', () => {
    const at = (id, created_at) => ({ id, created_at });
    const groups = groupMessagesByDay([
      at(1, '2026-10-05T09:00:00Z'),
      at(2, '2026-10-05T10:00:00Z'),
      at(3, '2026-10-06T09:00:00Z'),
      at(4, '2026-10-05T21:30:00Z'),
    ]);
    expect(groups.map((group) => [group.day, group.messages.map((item) => item.id)])).toEqual([
      ['2026-10-05', [1, 2]],
      ['2026-10-06', [3, 4]],
    ]);
  });

  it('points each chat type at the right page', () => {
    expect(chatDestination({ type: 'room', id: 4 })).toEqual({ path: '/rooms/4', label: 'View room' });
    expect(chatDestination({ type: 'group', id: 2 })).toEqual({ path: '/groups?group_id=2', label: 'View group' });
    expect(chatDestination({ type: 'direct', id: 8 })).toEqual({ path: '/users/8', label: 'View profile' });
  });

  it('finds a chat title from the inbox, then from the users list, then from the type', () => {
    const inbox = [{ type: 'room', room_id: 4, title: 'Sunday run', last_message: null }];
    const nameOf = (id) => `User${id}`;
    expect(chatTitle({ type: 'room', id: 4 }, inbox, nameOf)).toBe('Sunday run');
    expect(chatTitle({ type: 'direct', id: 8 }, inbox, nameOf)).toBe('User8');
    expect(chatTitle({ type: 'room', id: 12 }, inbox, nameOf)).toBe('Room chat 12');
    expect(chatTitle({ type: 'group', id: 3 }, [], nameOf)).toBe('Group chat 3');
  });

  it('explains why a chat could not be loaded', () => {
    expect(threadErrorMessage({ status: 403 })).toBe("You don't have access to this chat.");
    expect(threadErrorMessage({ status: 404 })).toBe('This chat no longer exists.');
    expect(threadErrorMessage({ status: 0, message: 'Unable to reach the server.' })).toBe('Unable to reach the server.');
    expect(threadErrorMessage(undefined)).toMatch(/Could not load/);
  });
});

describe('sending helpers', () => {
  it('accepts a message of 1 to 2000 characters after trimming', () => {
    expect(validateMessageBody('Hello')).toBe('');
    expect(validateMessageBody('  Hello  ')).toBe('');
    expect(validateMessageBody('a'.repeat(2000))).toBe('');
    expect(validateMessageBody(`  ${'a'.repeat(2000)}  `)).toBe('');
  });

  it('rejects an empty, all-space or too long message', () => {
    expect(validateMessageBody('')).toBe('Write a message first.');
    expect(validateMessageBody('   \n  ')).toBe('Write a message first.');
    expect(validateMessageBody('a'.repeat(2001))).toBe('Messages can be up to 2000 characters.');
  });

  it('explains why a chat has become read-only', () => {
    expect(sendBlockReason({ status: 409, message: 'This room is cancelled' }, 'room')).toBe("This room was cancelled, so you can't send messages.");
    expect(sendBlockReason({ status: 403, message: 'You do not have access to this chat' }, 'room')).toMatch(/no longer have access/);
    expect(sendBlockReason({ status: 403, message: 'You do not have access to this chat' }, 'group')).toMatch(/no longer have access/);
    expect(sendBlockReason({ status: 403, message: 'You can only message accepted friends' }, 'direct')).toBe('You can only message accepted friends.');
    expect(sendBlockReason({ status: 403, message: 'Messaging is blocked' }, 'direct')).toBe('Messaging is blocked between you and this person.');
    expect(sendBlockReason({ status: 403, message: 'something else' }, 'direct')).toBe("You can't send messages to this person.");
  });

  it('does not treat other failures as read-only', () => {
    expect(sendBlockReason({ status: 0, message: 'Unable to reach the server.' }, 'room')).toBe('');
    expect(sendBlockReason({ status: 422, message: 'body cannot be empty' }, 'room')).toBe('');
    expect(sendBlockReason({ status: 409, message: 'This message conflicts with existing data' }, 'room')).toBe('');
    expect(sendBlockReason(undefined, 'room')).toBe('');
  });

  it('merges messages by id and keeps them in order', () => {
    const existing = [{ id: 1, body: 'a' }, { id: 3, body: 'c' }];
    expect(mergeById(existing, [{ id: 2, body: 'b' }]).map((item) => item.id)).toEqual([1, 2, 3]);
    expect(mergeById(existing, [{ id: 3, body: 'changed' }]).find((item) => item.id === 3).body).toBe('changed');
    expect(mergeById([], [])).toEqual([]);
  });

  it('settles a pending message when its saved copy arrives, by request id', () => {
    const state = {
      messages: [{ id: 1 }],
      pending: [{ id: 'req-1', body: 'x', status: 'sending' }, { id: 'req-2', body: 'y', status: 'failed' }],
    };
    const result = receiveMessage(state, { id: 5, client_request_id: 'req-1', body: 'x' });
    expect(result.messages.map((item) => item.id)).toEqual([1, 5]);
    expect(result.pending.map((item) => item.id)).toEqual(['req-2']);
    const other = receiveMessage(state, { id: 6, client_request_id: null, body: 'from someone else' });
    expect(other.pending).toHaveLength(2);
  });
});
