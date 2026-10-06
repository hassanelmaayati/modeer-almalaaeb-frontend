import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useChatThread from '../../src/lib/helpers/useChatThread';
import useConversations from '../../src/lib/helpers/useConversations';
import messageService from '../../src/services/messageService';
import userService from '../../src/services/userService';
import roomService from '../../src/services/roomService';
import { recoverMessages } from '../../src/services/websocketService';

const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', async importOriginal => ({
  ...await importOriginal(),
  listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); },
  recoverMessages: vi.fn(),
}));
vi.mock('../../src/services/messageService', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, default: { ...actual.default, list: vi.fn(), create: vi.fn(), conversations: vi.fn() } };
});
vi.mock('../../src/services/userService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/roomService', () => ({ default: { get: vi.fn() } }));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const message = (id, extra = {}) => ({ id, body: 'Message ' + id, sender_id: 2, recipient_id: 1, created_at: '2030-01-01T12:00:00Z', ...extra });
const conversation = (id = 1) => ({ type: 'direct', user_id: 2, title: 'Bob', last_message: message(id) });
async function emit(event) { await act(async () => { for (const callback of live.listeners) callback(event); }); }
beforeEach(() => {
  live.listeners.clear();
  messageService.list.mockReset().mockResolvedValue([message(1)]);
  messageService.create.mockReset().mockImplementation(async body => message(2, { ...body, sender_id: 1 }));
  messageService.conversations.mockReset().mockResolvedValue([conversation()]);
  userService.list.mockReset().mockResolvedValue([{ id: 2, user_name: 'Bob' }]);
  roomService.get.mockReset().mockResolvedValue({ id: 1, status: 'open' });
  recoverMessages.mockReset().mockResolvedValue([message(1)]);
});

describe('chat delivery and recovery races', () => {
  it('loads history in ID order and sends trimmed text with a persistent retry ID', async () => {
    messageService.list.mockResolvedValue([message(3), message(1), message(1)]);
    messageService.create.mockRejectedValueOnce(new Error('Offline'));
    const { result } = renderHook(() => useChatThread('direct', 2, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages.map(item => item.id)).toEqual([1, 3]);
    act(() => { expect(result.current.send('  hello  ')).toBe(true); });
    await waitFor(() => expect(result.current.pending[0]?.status).toBe('failed'));
    const id = result.current.pending[0].id;
    expect(messageService.create.mock.calls[0][0]).toMatchObject({ recipient_id: 2, body: 'hello', client_request_id: id });
    act(() => result.current.retrySend(id));
    await waitFor(() => expect(result.current.pending).toEqual([]));
    expect(messageService.create.mock.calls[1][0].client_request_id).toBe(id);
    expect(result.current.messages.filter(item => item.client_request_id === id)).toHaveLength(1);
  });
  it('merges socket-first and HTTP-later delivery into one saved message', async () => {
    const post = deferred();
    messageService.create.mockReturnValue(post.promise);
    const { result } = renderHook(() => useChatThread('direct', 2, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.send('Socket first'));
    const saved = message(2, { sender_id: 1, recipient_id: 2, body: 'Socket first', client_request_id: result.current.pending[0].id });
    await emit({ type: 'message.created', message: saved });
    expect(result.current.pending).toEqual([]);
    await act(async () => { post.resolve(saved); await post.promise; });
    expect(result.current.messages.filter(item => item.id === 2)).toEqual([saved]);
  });
  it('preserves a live message that arrives while reconnect recovery is pending', async () => {
    const recovery = deferred();
    recoverMessages.mockReturnValue(recovery.promise);
    const { result } = renderHook(() => useChatThread('direct', 2, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await emit({ type: 'connection.ready' });
    await emit({ type: 'message.created', message: message(3) });
    await act(async () => { recovery.resolve([message(1), message(2)]); await recovery.promise; });
    expect(result.current.messages.map(item => item.id)).toEqual([1, 2, 3]);
  });
  it.each([
    ['direct', { status: 403, message: 'Friend is blocked' }, /blocked between/],
    ['group', { status: 403, message: 'Membership removed' }, /no longer have access/],
    ['room', { status: 409, message: 'Room cancelled' }, /room was cancelled/],
  ])('makes a final %s permission failure nonretryable', async (type, failure, reason) => {
    messageService.create.mockRejectedValue(failure);
    const { result } = renderHook(() => useChatThread(type, 2, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.send('Denied'));
    await waitFor(() => expect(result.current.blockedReason).toMatch(reason));
    const id = result.current.pending[0].id;
    expect(result.current.pending[0].blocked).toBe(true);
    act(() => { result.current.retrySend(id); expect(result.current.send('Another')).toBe(false); });
    expect(messageService.create).toHaveBeenCalledOnce();
    act(() => result.current.discard(id));
    expect(result.current.pending).toEqual([]);
  });
  it('ignores other conversations and removes its socket subscription when unmounted', async () => {
    const { result, unmount } = renderHook(() => useChatThread('direct', 2, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await emit({ type: 'message.created', message: message(2, { sender_id: 8 }) });
    expect(result.current.messages.map(item => item.id)).toEqual([1]);
    unmount();
    expect(live.listeners.size).toBe(0);
  });
  it('recovers load errors with explicit reload and rejects empty or oversized sends', async () => {
    messageService.list.mockRejectedValueOnce({ status: 403, message: 'Denied' });
    const { result } = renderHook(() => useChatThread('direct', 2, 1));
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBeNull());
    act(() => {
      expect(result.current.send('   ')).toBe(false);
      expect(result.current.send('x'.repeat(2001))).toBe(false);
    });
    expect(messageService.create).not.toHaveBeenCalled();
  });
  it('paginates earlier messages before the oldest ID and retains current data on failure', async () => {
    const history = Array.from({ length: 50 }, (_, index) => message(index + 51));
    messageService.list.mockResolvedValueOnce(history).mockRejectedValueOnce(new Error('Earlier unavailable')).mockResolvedValueOnce([message(49), message(50)]);
    const { result } = renderHook(() => useChatThread('direct', 2, 1));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => result.current.loadEarlier());
    expect(result.current.earlierError).toBe('Earlier unavailable');
    expect(result.current.messages).toHaveLength(50);
    await act(async () => result.current.loadEarlier());
    expect(messageService.list.mock.calls[2][0]).toMatchObject({ user_id: 2, before: 51, limit: 50 });
    expect(result.current.messages[0].id).toBe(49);
    expect(result.current.hasMore).toBe(false);
  });
  it.each(['group', 'room'])('reauthorizes a matching %s update and clears inaccessible cached history', async type => {
    const failure = { status: 403, message: 'Membership removed' };
    const { result } = renderHook(() => useChatThread(type, 2, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    await emit({ type: `${type}.updated`, [`${type}_id`]: 9 });
    expect(messageService.list).toHaveBeenCalledOnce();
    messageService.list.mockRejectedValueOnce(failure);
    await emit({ type: `${type}.updated`, [`${type}_id`]: 2 });
    await waitFor(() => expect(result.current.error).toEqual(failure));
    expect(messageService.list).toHaveBeenCalledTimes(2);
    expect(result.current.messages).toEqual([]);
    act(() => expect(result.current.send('Revoked')).toBe(false));
    expect(messageService.create).not.toHaveBeenCalled();
  });
  it('handles a revoked reconnect recovery as a final error instead of retaining authorized UI state', async () => {
    const failure = { status: 403, message: 'Group membership removed while offline' };
    const { result } = renderHook(() => useChatThread('group', 2, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    recoverMessages.mockRejectedValueOnce(failure);
    await emit({ type: 'connection.ready' });
    await waitFor(() => expect(result.current.error).toEqual(failure));
    expect(result.current.messages).toEqual([]);
  });
  it('ignores a late earlier page after a permission reload revoked access', async () => {
    const earlier = deferred();
    const failure = { status: 403, message: 'Membership removed' };
    messageService.list.mockResolvedValueOnce(Array.from({ length: 50 }, (_, index) => message(index + 51))).mockReturnValueOnce(earlier.promise).mockRejectedValueOnce(failure);
    const { result } = renderHook(() => useChatThread('group', 2, 1));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    let loading;
    act(() => { loading = result.current.loadEarlier(); });
    await emit({ type: 'group.updated', group_id: 2 });
    await waitFor(() => expect(result.current.error).toEqual(failure));
    await act(async () => { earlier.resolve([message(50)]); await loading; });
    expect(result.current.error).toEqual(failure);
    expect(result.current.messages).toEqual([]);
    expect(result.current.earlierError).toBe('');
    expect(result.current.loadingEarlier).toBe(false);
  });
  it('preserves a socket arrival while a successful permission recheck snapshot is pending', async () => {
    const snapshot = deferred();
    const initial = message(1, { group_id: 2 });
    messageService.list.mockResolvedValueOnce([initial]).mockReturnValueOnce(snapshot.promise);
    const { result } = renderHook(() => useChatThread('group', 2, 1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await emit({ type: 'group.updated', group_id: 2 });
    await emit({ type: 'message.created', message: message(2, { group_id: 2 }) });
    await act(async () => { snapshot.resolve([initial]); await snapshot.promise; });
    expect(result.current.messages.map(item => item.id)).toEqual([1, 2]);
  });
  it('retains previously loaded earlier pages and their completion state after an authorized room update', async () => {
    const recent = Array.from({ length: 50 }, (_, index) => message(index + 51, { room_id: 2 }));
    messageService.list.mockResolvedValueOnce(recent).mockResolvedValueOnce([message(49, { room_id: 2 }), message(50, { room_id: 2 })]).mockResolvedValueOnce(recent);
    const { result } = renderHook(() => useChatThread('room', 2, 1));
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => result.current.loadEarlier());
    expect(result.current.messages).toHaveLength(52);
    expect(result.current.hasMore).toBe(false);
    await emit({ type: 'room.updated', room_id: 2 });
    await waitFor(() => expect(messageService.list).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.messages).toHaveLength(52);
    expect(result.current.messages[0].id).toBe(49);
    expect(result.current.hasMore).toBe(false);
  });
  it.each(['thread', 'account'])('clears old history on a %s switch instead of merging it into the new scope', async change => {
    const snapshot = deferred();
    messageService.list.mockResolvedValueOnce([message(1, { group_id: 2 })]).mockReturnValueOnce(snapshot.promise);
    const { result, rerender } = renderHook(({ id, viewerId }) => useChatThread('group', id, viewerId), { initialProps: { id: 2, viewerId: 1 } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender(change === 'thread' ? { id: 3, viewerId: 1 } : { id: 2, viewerId: 2 });
    await waitFor(() => expect(messageService.list).toHaveBeenCalledTimes(2));
    expect(result.current.messages).toEqual([]);
    await act(async () => { snapshot.resolve([message(2, { group_id: change === 'thread' ? 3 : 2 })]); await snapshot.promise; });
    expect(result.current.messages.map(item => item.id)).toEqual([2]);
  });
});

describe('conversation refresh and account isolation', () => {
  it('orders known conversations by new messages and ignores duplicate or older events', async () => {
    messageService.conversations.mockResolvedValue([conversation(3), { type: 'room', room_id: 4, title: 'Football', last_message: message(4, { room_id: 4 }) }]);
    const { result } = renderHook(() => useConversations(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await emit({ type: 'message.created', message: message(5) });
    expect(result.current.conversations[0].type).toBe('direct');
    await emit({ type: 'message.created', message: message(2) });
    expect(result.current.conversations[0].last_message.id).toBe(5);
  });
  it('does not let an older live refresh overwrite the newer result', async () => {
    const old = deferred(), fresh = deferred();
    const { result } = renderHook(() => useConversations(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    messageService.conversations.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    await emit({ type: 'connection.ready' });
    await emit({ type: 'friend.updated' });
    await act(async () => { fresh.resolve([conversation(3)]); await fresh.promise; });
    expect(result.current.conversations[0].last_message.id).toBe(3);
    await act(async () => { old.resolve([conversation(2)]); await old.promise; });
    expect(result.current.conversations[0].last_message.id).toBe(3);
  });
  it('aborts a live refresh and unsubscribes when the inbox is unmounted', async () => {
    const pending = deferred();
    const { result, unmount } = renderHook(() => useConversations(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    messageService.conversations.mockReturnValueOnce(pending.promise);
    await emit({ type: 'connection.ready' });
    const options = messageService.conversations.mock.calls[1][1];
    unmount();
    expect(options.signal.aborted).toBe(true);
    expect(live.listeners.size).toBe(0);
    pending.resolve([conversation(9)]);
    await pending.promise;
  });
  it('refreshes group access changes so removed conversations disappear from the inbox', async () => {
    messageService.conversations.mockResolvedValueOnce([{ type: 'group', group_id: 2, title: 'Private group', last_message: message(1, { group_id: 2 }) }]).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useConversations(1));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.conversations).toHaveLength(1);
    await emit({ type: 'group.updated', group_id: 2 });
    await waitFor(() => expect(result.current.conversations).toEqual([]));
    expect(messageService.conversations).toHaveBeenCalledTimes(2);
  });
});
