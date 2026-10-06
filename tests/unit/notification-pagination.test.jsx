import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationsPage from '../../src/pages/NotificationsPage';
import useMessageUnread from '../../src/lib/helpers/useMessageUnread';
import useMarkChatRead from '../../src/lib/helpers/useMarkChatRead';
import notificationService from '../../src/services/notificationService';

const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));
vi.mock('../../src/services/notificationService', () => ({ default: { list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() } }));
const notice = (id, extra = {}) => ({ id, kind: 'message.created', target: { type: 'direct', id: 2 }, text: 'Saved notice ' + id, created_at: '2030-01-01T12:00:00Z', read_at: null, ...extra });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
beforeEach(() => {
  live.listeners.clear();
  notificationService.list.mockReset().mockResolvedValue({ items: [], unread_count: 0 });
  notificationService.markRead.mockReset().mockResolvedValue(null);
  notificationService.markAllRead.mockReset().mockResolvedValue(null);
});

describe('saved notification pagination and mutation failures', () => {
  it('moves through before-ID history and returns to the latest page', async () => {
    const first = Array.from({ length: 50 }, (_, index) => notice(200 - index));
    notificationService.list.mockResolvedValueOnce({ items: first, unread_count: 51 }).mockResolvedValueOnce({ items: [notice(150)], unread_count: 51 }).mockResolvedValueOnce({ items: first, unread_count: 51 });
    render(<MemoryRouter><NotificationsPage session={{ user: { id: 1 } }} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Older notifications' }));
    expect(await screen.findByText('Saved notice 150')).toBeVisible();
    expect(notificationService.list.mock.calls[1][0]).toEqual({ limit: 50, before: 151 });
    expect(screen.queryByText('Saved notice 200')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Latest notifications' }));
    expect(await screen.findByText('Saved notice 200')).toBeVisible();
    expect(notificationService.list.mock.calls[2][0].before).toBeNull();
  });
  it('keeps an unread notification and re-enables read controls when persistence fails', async () => {
    notificationService.list.mockResolvedValue({ items: [notice(1)], unread_count: 1 });
    notificationService.markRead.mockRejectedValueOnce(new Error('Read failed'));
    render(<MemoryRouter><NotificationsPage session={{ user: { id: 1 } }} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark read' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Read failed');
    expect(screen.getByText('Unread')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark read' })).toBeEnabled();
    expect(notificationService.list).toHaveBeenCalledOnce();
  });
  it('marks a notification read when opening its supported destination', async () => {
    notificationService.list.mockResolvedValue({ items: [notice(1)], unread_count: 1 });
    render(<MemoryRouter><NotificationsPage session={{ user: { id: 1 } }} /></MemoryRouter>);
    const link = await screen.findByRole('link', { name: 'Open details' });
    expect(link).toHaveAttribute('href', '/messages/direct/2');
    fireEvent.click(link);
    await waitFor(() => expect(notificationService.markRead).toHaveBeenCalledWith(1));
  });
});

describe('complete unread message counts and account isolation', () => {
  it('includes unread messages beyond the first hundred saved notifications', async () => {
    const first = Array.from({ length: 100 }, (_, index) => notice(200 - index));
    notificationService.list.mockResolvedValueOnce({ items: first, unread_count: 102 }).mockResolvedValueOnce({ items: [notice(100), notice(99, { kind: 'friend.request' })], unread_count: 102 });
    const { result } = renderHook(() => useMessageUnread(1));
    await waitFor(() => expect(result.current.total).toBe(101));
    expect(result.current.counts['direct:2']).toBe(101);
    expect(result.current.ids['direct:2']).toContain(100);
    expect(notificationService.list.mock.calls[1][0]).toEqual({ unread_only: true, limit: 100, before: 101 });
  });
  it('aborts all unread loading after account change and ignores a late old-account page', async () => {
    const old = deferred();
    notificationService.list.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ items: [notice(2, { target: { type: 'group', id: 3 } })], unread_count: 1 });
    const { result, rerender } = renderHook(({ id }) => useMessageUnread(id), { initialProps: { id: 1 } });
    await waitFor(() => expect(notificationService.list).toHaveBeenCalledOnce());
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.counts).toEqual({ 'group:3': 1 }));
    expect(notificationService.list.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { old.resolve({ items: [notice(9)], unread_count: 1 }); await old.promise; });
    expect(result.current.counts).toEqual({ 'group:3': 1 });
    rerender({ id: null });
    expect(result.current.total).toBe(0);
  });
  it('deduplicates overlapping pages and stops if an unread cursor fails to advance', async () => {
    const first = Array.from({ length: 100 }, (_, index) => notice(200 - index));
    notificationService.list.mockResolvedValue({ items: first, unread_count: 100 });
    const { result } = renderHook(() => useMessageUnread(1));
    await waitFor(() => expect(result.current.total).toBe(100));
    expect(notificationService.list).toHaveBeenCalledTimes(2);
    expect(result.current.ids['direct:2']).toHaveLength(100);
  });
  it('does not request private unread data for guests and refetches after read events', async () => {
    const { result, rerender, unmount } = renderHook(({ id }) => useMessageUnread(id), { initialProps: { id: null } });
    expect(result.current.total).toBe(0);
    expect(notificationService.list).not.toHaveBeenCalled();
    notificationService.list.mockResolvedValueOnce({ items: [notice(1)], unread_count: 1 });
    rerender({ id: 1 });
    await waitFor(() => expect(result.current.total).toBe(1));
    await act(async () => { for (const callback of live.listeners) callback({ type: 'notifications.updated' }); });
    await waitFor(() => expect(result.current.total).toBe(0));
    unmount();
    expect(live.listeners.size).toBe(0);
  });
});

describe('read marking deduplication and retry', () => {
  it('does not duplicate an in-flight read while the unread list gains another item', async () => {
    const first = deferred();
    notificationService.markRead.mockReturnValueOnce(first.promise);
    const { rerender } = renderHook(({ ids }) => useMarkChatRead('direct:2', ids), { initialProps: { ids: [1] } });
    rerender({ ids: [1, 2] });
    expect(notificationService.markRead.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    await act(async () => first.resolve(null));
  });
  it('releases a failed read so a later unread update can retry it', async () => {
    notificationService.markRead.mockRejectedValueOnce(new Error('Offline'));
    const { rerender } = renderHook(({ ids }) => useMarkChatRead('direct:2', ids), { initialProps: { ids: [1] } });
    await act(async () => { await Promise.resolve(); });
    rerender({ ids: [1, 2] });
    expect(notificationService.markRead.mock.calls.map(([id]) => id)).toEqual([1, 1, 2]);
  });
  it('does not mark anything for a missing chat or empty unread IDs', () => {
    const { rerender } = renderHook(({ key, ids }) => useMarkChatRead(key, ids), { initialProps: { key: null, ids: [1] } });
    rerender({ key: 'direct:2', ids: [] });
    expect(notificationService.markRead).not.toHaveBeenCalled();
  });
});
