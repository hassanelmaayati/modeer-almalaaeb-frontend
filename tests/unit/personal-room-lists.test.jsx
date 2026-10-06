import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePagedRooms from '../../src/lib/helpers/usePagedRooms';
import { joinedRoomFilters, joinedRoomsEmptyState, myRoomFilters, myRoomsEmptyState, toApiFilters, withHomeGovernorate } from '../../src/lib/helpers/filters';
import { startRequest } from '../../src/lib/helpers/request';

const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));
const page = (ids, total = ids.length, hasMore = false) => ({ items: ids.map(id => ({ id })), total, has_more: hasMore });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
beforeEach(() => live.listeners.clear());

describe('personal room view and URL contracts', () => {
  it.each([
    ['upcoming', ['accepted'], ['open', 'started'], undefined, 'asc'],
    ['past', ['accepted'], ['completed', 'cancelled'], undefined, 'desc'],
    ['requests', ['pending'], ['open', 'started'], 'true', 'asc'],
    ['invitations', ['pending'], ['open', 'started'], 'false', 'asc'],
    ['other', ['declined', 'removed', 'left'], [], undefined, 'desc'],
  ])('builds the %s view with the correct membership and status scope', (view, membership, status, requested, order) => {
    const query = joinedRoomFilters.toQuery({ view });
    expect(query).toMatchObject({ membership, order, limit: 20, offset: 0 });
    expect(query.status).toEqual(status);
    expect(query.requested).toBe(requested);
    expect(query).not.toHaveProperty('view');
  });
  it('round trips repeated statuses and memberships without losing filter choices', () => {
    const input = { view: 'other', membership: ['left', 'removed'], status: ['cancelled', 'completed'], sport_id: '2' };
    const params = joinedRoomFilters.toSearchParams(input);
    expect(params.getAll('status')).toEqual(['cancelled', 'completed']);
    expect(joinedRoomFilters.get(params)).toEqual(input);
  });
  it('drops previous view presets when switching while retaining explicit activity/date filters', () => {
    expect(joinedRoomFilters.withView({ view: 'requests', membership: ['pending'], requested: 'true', status: ['open'], order: 'asc', sport_id: '2', starts_from: '2030-01-01T12:00:00Z' }, 'past'))
      .toEqual({ view: 'past', sport_id: '2', starts_from: '2030-01-01T12:00:00Z' });
  });
  it('normalizes unordered presets and leaves original inputs unchanged', () => {
    const input = { view: 'active', status: ['started', 'open'], order: 'asc' };
    expect(myRoomFilters.normalize(input)).toEqual({});
    expect(input.status).toEqual(['started', 'open']);
    expect(myRoomFilters.toQuery({ view: 'all' }).status).toEqual([]);
  });
  it.each([
    [{ view: 'missing' }, /valid view/],
    [{ status: ['open', 'missing'] }, /valid status/],
    [{ membership: ['host'] }, /valid membership/],
    [{ requested: 'yes' }, /valid request/],
    [{ order: 'random' }, /valid order/],
    [{ sport_id: '-1' }, /valid activity/],
    [{ starts_from: 'bad' }, /valid dates/],
  ])('rejects invalid personal filters %o before sending them', (values, message) => {
    expect(joinedRoomFilters.validate(values)).toMatch(message);
  });
  it('distinguishes ordinary empty views from a refined search', () => {
    expect(joinedRoomsEmptyState({ view: 'requests' })).toMatchObject({ title: 'No pending requests', action: 'browse' });
    expect(joinedRoomsEmptyState({ view: 'requests', sport_id: '2' })).toMatchObject({ title: 'No rooms match these filters', action: 'clear' });
    expect(myRoomsEmptyState({ view: 'history' }).title).toBe('No room history yet');
  });
  it('defaults discovery to the account governorate and permits explicit all governorates', () => {
    expect(withHomeGovernorate({}, { district: 'capital' })).toEqual({ district: 'capital' });
    expect(withHomeGovernorate({ district: 'all' }, { district: 'capital' })).toEqual({ district: 'all' });
    expect(toApiFilters({ district: 'all', sport_id: '2' })).toEqual({ sport_id: '2' });
    expect(toApiFilters(withHomeGovernorate({}, null))).toEqual({});
  });
});

describe('personal list pagination, errors and stale requests', () => {
  it('appends the next page without duplicate rooms and uses the loaded offset', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(page([1, 2], 3, true)).mockResolvedValueOnce(page([2, 3], 3));
    const { result } = renderHook(() => usePagedRooms({ searchKey: '', filterSet: myRoomFilters, fetchPage }));
    await waitFor(() => expect(result.current.current?.items).toHaveLength(2));
    await act(async () => result.current.loadMore());
    expect(fetchPage.mock.calls[1][0]).toMatchObject({ offset: 2, limit: 20 });
    expect(result.current.current.items.map(room => room.id)).toEqual([1, 2, 3]);
    expect(result.current.current.hasMore).toBe(false);
  });
  it('retains loaded data after a page failure and allows retrying the same offset', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(page([1], 2, true)).mockRejectedValueOnce(new Error('Next page unavailable')).mockResolvedValueOnce(page([2], 2));
    const { result } = renderHook(() => usePagedRooms({ searchKey: '', filterSet: myRoomFilters, fetchPage }));
    await waitFor(() => expect(result.current.current).not.toBeNull());
    await act(async () => result.current.loadMore());
    expect(result.current.more.error).toBe('Next page unavailable');
    expect(result.current.current.items).toEqual([{ id: 1 }]);
    await act(async () => result.current.loadMore());
    expect(result.current.more.error).toBe('');
    expect(result.current.current.items).toEqual([{ id: 1 }, { id: 2 }]);
  });
  it('ignores an older initial response when filters change and aborts its request', async () => {
    const old = deferred();
    const fetchPage = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(page([8]));
    const { result, rerender } = renderHook(({ searchKey }) => usePagedRooms({ searchKey, filterSet: myRoomFilters, fetchPage }), { initialProps: { searchKey: '' } });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledOnce());
    rerender({ searchKey: 'view=history' });
    await waitFor(() => expect(result.current.current?.items).toEqual([{ id: 8 }]));
    expect(fetchPage.mock.calls[0][1].aborted).toBe(true);
    await act(async () => { old.resolve(page([1])); await old.promise; });
    expect(result.current.current.items).toEqual([{ id: 8 }]);
  });
  it('ignores an old load-more response after a filter change', async () => {
    const old = deferred();
    const fetchPage = vi.fn().mockResolvedValueOnce(page([1], 2, true)).mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([9]));
    const { result, rerender } = renderHook(({ searchKey }) => usePagedRooms({ searchKey, filterSet: myRoomFilters, fetchPage }), { initialProps: { searchKey: '' } });
    await waitFor(() => expect(result.current.current).not.toBeNull());
    let pending;
    act(() => { pending = result.current.loadMore(); });
    rerender({ searchKey: 'view=history' });
    await waitFor(() => expect(result.current.current?.items).toEqual([{ id: 9 }]));
    await act(async () => { old.resolve(page([2])); await pending; });
    expect(result.current.current.items).toEqual([{ id: 9 }]);
  });
  it('validates bookmarked filters before a network request and unregisters live listeners', async () => {
    const fetchPage = vi.fn();
    const { result, unmount } = renderHook(() => usePagedRooms({ searchKey: 'status=missing', filterSet: myRoomFilters, fetchPage }));
    await waitFor(() => expect(result.current.error?.message).toBe('Choose a valid status.'));
    expect(fetchPage).not.toHaveBeenCalled();
    expect(live.listeners.size).toBe(1);
    unmount();
    expect(live.listeners.size).toBe(0);
  });
  it('refetches the already loaded range after a live update while ignoring unrelated events', async () => {
    const ids = Array.from({ length: 20 }, (_, index) => index + 1);
    const fetchPage = vi.fn().mockResolvedValueOnce(page(ids, 40, true)).mockResolvedValueOnce(page(ids.map(id => id + 20), 40)).mockResolvedValue(page(ids, 20));
    const { result } = renderHook(() => usePagedRooms({ searchKey: 'view=history', filterSet: myRoomFilters, fetchPage }));
    await waitFor(() => expect(result.current.current?.items).toHaveLength(20));
    await act(async () => result.current.loadMore());
    await act(async () => { for (const listener of live.listeners) listener({ type: 'message.created' }); });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    await act(async () => { for (const listener of live.listeners) listener({ type: 'room.updated', room_id: 1 }); });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    expect(fetchPage.mock.calls[2][0]).toMatchObject({ limit: 40, offset: 0, order: 'desc' });
  });
});

describe('effect request cancellation', () => {
  it('does not start an effect request cancelled before the microtask runs', async () => {
    const load = vi.fn();
    const update = vi.fn();
    startRequest(load, update)();
    await Promise.resolve();
    expect(load).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('aborts an in-flight request and ignores its late failure after unmount', async () => {
    const pending = deferred();
    const load = vi.fn(() => pending.promise);
    const update = vi.fn();
    const cleanup = startRequest(load, update);
    await Promise.resolve();
    cleanup();
    pending.reject(new Error('Late failure'));
    await pending.promise.catch(() => {});
    await Promise.resolve();
    expect(load.mock.calls[0][0].aborted).toBe(true);
    expect(update).toHaveBeenCalledOnce();
  });
});
