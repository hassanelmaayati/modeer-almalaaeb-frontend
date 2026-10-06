import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatUnreadCount, isMessageNotification, summarizeUnread } from '../../src/lib/helpers/messages';

const notice = (id, kind, type, targetId, extra = {}) => ({ id, kind, target: { type, id: targetId }, read_at: null, ...extra });

const listeners = new Set();
const emit = (event) => act(() => { for (const listener of [...listeners]) listener(event); });
const notifications = vi.fn();
const markRead = vi.fn();

vi.mock('../../src/services/notificationService', () => ({
  default: { list: (...args) => notifications(...args), markRead: (...args) => markRead(...args) },
}));
vi.mock('../../src/services/messageService', () => ({
  default: {
    conversations: async () => [
      { type: 'room', room_id: 4, title: 'Sunday run', last_message: null },
      { type: 'group', group_id: 2, title: 'Runners', last_message: null },
      { type: 'direct', user_id: 8, title: 'Sara', last_message: null },
    ],
    list: async () => [],
    create: vi.fn(),
    targetQuery: ({ type, id }) => ({ [`${type}_id`]: Number(id) }),
    targetBody: () => ({}),
  },
}));
vi.mock('../../src/services/roomService', () => ({ default: { get: async () => ({ id: 4, status: 'open' }) } }));
vi.mock('../../src/services/userService', () => ({ default: { list: async () => [{ id: 1, user_name: 'Me' }, { id: 8, user_name: 'Sara' }] } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  recoverMessages: async (target, existing) => existing,
  mergeMessages: (existing, incoming) => [...existing, ...incoming],
}));
const { default: useMessageUnread } = await import('../../src/lib/helpers/useMessageUnread');
const { default: MessagesPage } = await import('../../src/pages/MessagesPage');

describe('unread helpers', () => {
  it('recognises message notifications with a valid chat target only', () => {
    expect(isMessageNotification(notice(1, 'message.room', 'room', 4))).toBe(true);
    expect(isMessageNotification(notice(1, 'friend.request', 'direct', 4))).toBe(false);
    expect(isMessageNotification(notice(1, 'message.room', 'room', 0))).toBe(false);
    expect(isMessageNotification(notice(1, 'message.room', 'cup', 4))).toBe(false);
    expect(isMessageNotification(null)).toBe(false);
  });

  it('counts unread message notifications per chat', () => {
    const summary = summarizeUnread([
      notice(1, 'message.room', 'room', 4),
      notice(2, 'message.room', 'room', 4),
      notice(3, 'message.direct', 'direct', 8),
      notice(4, 'message.group', 'group', 2, { read_at: '2026-01-01' }),
      notice(5, 'room.updated', 'room', 4),
    ]);
    expect(summary.total).toBe(3);
    expect(summary.counts).toEqual({ 'room:4': 2, 'direct:8': 1 });
    expect(summary.ids['room:4']).toEqual([1, 2]);
  });

  it('caps the displayed number', () => {
    expect(formatUnreadCount(7)).toBe('7');
    expect(formatUnreadCount(100)).toBe('99+');
  });
});

describe('useMessageUnread', () => {
  beforeEach(() => {
    listeners.clear();
    notifications.mockReset();
  });

  it('loads unread notifications and refreshes when a new one arrives', async () => {
    notifications.mockResolvedValue({ items: [notice(1, 'message.room', 'room', 4)], unread_count: 1 });
    const { result } = renderHook(() => useMessageUnread(1));
    await waitFor(() => expect(result.current.total).toBe(1));
    expect(notifications.mock.calls[0][0]).toEqual({ unread_only: true, limit: 100 });

    notifications.mockResolvedValue({ items: [notice(2, 'message.room', 'room', 4), notice(1, 'message.room', 'room', 4)], unread_count: 2 });
    await emit({ type: 'notification.created' });
    await waitFor(() => expect(result.current.total).toBe(2));
  });

  it('is empty without a signed-in user', () => {
    const { result } = renderHook(() => useMessageUnread(undefined));
    expect(result.current.total).toBe(0);
    expect(notifications).not.toHaveBeenCalled();
  });
});

describe('unread in the Messages page', () => {
  const unread = summarizeUnread([
    notice(11, 'message.room', 'room', 4),
    notice(12, 'message.room', 'room', 4),
    notice(13, 'message.direct', 'direct', 8),
  ]);
  const mount = (path, value = unread) => render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/messages" element={<MessagesPage session={{ user: { id: 1 } }} unread={value} />} />
        <Route path="/messages/:type/:id" element={<MessagesPage session={{ user: { id: 1 } }} unread={value} />} />
      </Routes>
    </MemoryRouter>,
  );

  beforeEach(() => {
    listeners.clear();
    markRead.mockReset().mockResolvedValue({});
  });

  it('shows a count on chats that have unread messages and nothing on others', async () => {
    mount('/messages');
    const sidebar = await screen.findByRole('complementary', { name: 'Chats' });
    expect(await within(sidebar).findByLabelText('2 unread')).toBeInTheDocument();
    expect(within(sidebar).getByLabelText('1 unread')).toBeInTheDocument();
    expect(within(sidebar).getAllByLabelText(/unread/)).toHaveLength(2);
    expect(markRead).not.toHaveBeenCalled();
  });

  it('marks only the opened chat as read', async () => {
    mount('/messages/room/4');
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(2));
    expect(markRead.mock.calls.map((call) => call[0]).sort()).toEqual([11, 12]);
  });

  it('does not send the same read request twice while one is in flight', async () => {
    markRead.mockReturnValue(new Promise(() => {}));
    const view = mount('/messages/room/4');
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(2));
    view.rerender(
      <MemoryRouter initialEntries={['/messages/room/4']}>
        <Routes><Route path="/messages/:type/:id" element={<MessagesPage session={{ user: { id: 1 } }} unread={{ ...unread }} />} /></Routes>
      </MemoryRouter>,
    );
    expect(markRead).toHaveBeenCalledTimes(2);
  });
});
