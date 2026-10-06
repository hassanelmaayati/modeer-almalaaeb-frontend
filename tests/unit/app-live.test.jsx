import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';
import notificationService from '../../src/services/notificationService';
import websocketService from '../../src/services/websocketService';

const state = vi.hoisted(() => ({ sessions: new Set(), events: new Set(), stops: [], badges: vi.fn() }));
vi.mock('../../src/lib/helpers/auth', () => ({
  initialSession: () => ({ user: null, loading: false }),
  watchUser: callback => { state.sessions.add(callback); return () => state.sessions.delete(callback); },
  authenticate: vi.fn(), signOut: vi.fn(),
}));
vi.mock('../../src/services/websocketService', () => {
  const listen = callback => { state.events.add(callback); return () => state.events.delete(callback); };
  return { listen, default: {
    listen, watchStatus: () => () => {}, startLobby: () => () => {},
    start: vi.fn(() => { const stop = vi.fn(); state.stops.push(stop); return stop; }),
  } };
});
vi.mock('../../src/services/notificationService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: vi.fn(async () => []) } }));
vi.mock('../../src/services/roomService', () => ({ default: { list: vi.fn(async () => []) } }));

async function changeUser(id) {
  await act(async () => {
    for (const callback of state.sessions) callback({ user: id ? { id, user_name: `Player ${id}` } : null, loading: false });
  });
}

beforeEach(() => {
  state.sessions.clear(); state.events.clear(); state.stops.length = 0;
  state.badges.mockReset().mockResolvedValue({ items: [], unread_count: 0 });
  notificationService.list.mockReset().mockImplementation((query, options) => query.unread_only
    ? Promise.resolve({ items: [], unread_count: 0 })
    : state.badges(query, options));
  websocketService.start.mockClear();
});

describe('application session and live notifications', () => {
  it('loads the complete guest application before notification data exists without private requests', async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Find your people. Get moving.' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'No upcoming activities' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();
    expect(notificationService.list).not.toHaveBeenCalled();
    expect(websocketService.start).not.toHaveBeenCalled();
  });

  it('never displays another account unread count or a late result after switching accounts or signing out', async () => {
    let first, second;
    state.badges
      .mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
    render(<MemoryRouter><App /></MemoryRouter>);
    await changeUser(1);
    await waitFor(() => expect(state.badges).toHaveBeenCalledTimes(1));
    const firstSignal = state.badges.mock.calls[0][1].signal;
    await changeUser(2);
    await waitFor(() => expect(state.badges).toHaveBeenCalledTimes(2));
    expect(firstSignal.aborted).toBe(true);
    await act(async () => first({ items: [], unread_count: 99 }));
    expect(screen.getByRole('link', { name: 'Notifications', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Notifications (99)' })).not.toBeInTheDocument();
    await act(async () => second({ items: [], unread_count: 3 }));
    expect(await screen.findByRole('link', { name: 'Notifications (3)' })).toBeInTheDocument();
    await changeUser(1);
    expect(screen.queryByRole('link', { name: 'Notifications (3)' })).not.toBeInTheDocument();
    await changeUser(null);
    expect(screen.queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();
    expect(state.stops.every(stop => stop.mock.calls.length === 1)).toBe(true);
  });

  it('refetches the saved unread count after live read updates and cleans up app listeners', async () => {
    state.badges.mockResolvedValueOnce({ items: [], unread_count: 2 });
    const view = render(<MemoryRouter><App /></MemoryRouter>);
    await changeUser(1);
    expect(await screen.findByRole('link', { name: 'Notifications (2)' })).toBeInTheDocument();
    await act(async () => { for (const callback of state.events) callback({ type: 'notifications.updated' }); });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Notifications', exact: true })).toBeInTheDocument());
    expect(state.badges).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(state.events.size).toBe(0);
    expect(state.sessions.size).toBe(0);
    expect(state.stops[0]).toHaveBeenCalledOnce();
  });

  it('clears the previous badge on logout before signing back into the same account', async () => {
    let fresh;
    state.badges
      .mockResolvedValueOnce({ items: [], unread_count: 5 })
      .mockImplementationOnce(() => new Promise(resolve => { fresh = resolve; }));
    render(<MemoryRouter><App /></MemoryRouter>);
    await changeUser(1);
    expect(await screen.findByRole('link', { name: 'Notifications (5)' })).toBeInTheDocument();
    await changeUser(null);
    expect(screen.queryByRole('link', { name: /Notifications/ })).not.toBeInTheDocument();
    expect(state.badges).toHaveBeenCalledTimes(1);
    await changeUser(1);
    await waitFor(() => expect(state.badges).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('link', { name: 'Notifications', exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Notifications (5)' })).not.toBeInTheDocument();
    await act(async () => fresh({ items: [], unread_count: 1 }));
    expect(await screen.findByRole('link', { name: 'Notifications (1)' })).toBeInTheDocument();
  });
});
