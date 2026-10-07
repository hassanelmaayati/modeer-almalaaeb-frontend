import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';

const state = vi.hoisted(() => ({ sessions: new Set(), signedIn: true, offline: false, retry: vi.fn(), wake: null, signOut: null }));
vi.mock('../../src/lib/helpers/auth', () => ({
  initialSession: () => ({ user: state.signedIn ? { id: 1, user_name: 'Alice' } : null, loading: state.offline, ...(state.offline ? { offline: true } : {}) }),
  watchUser: callback => { state.sessions.add(callback); const stop = () => state.sessions.delete(callback); stop.retry = state.retry; return stop; },
  authenticate: vi.fn(),
  signOut: (...args) => state.signOut(...args),
}));
vi.mock('../../src/lib/api/client', async importOriginal => ({
  ...await importOriginal(),
  watchServerWaking: listener => { state.wake = listener; listener(false); return () => { state.wake = null; }; },
}));
vi.mock('../../src/services/websocketService', () => {
  const listen = () => () => {};
  return { listen, default: { listen, watchStatus: () => () => {}, startLobby: () => () => {}, start: vi.fn(() => () => {}) } };
});
vi.mock('../../src/services/notificationService', () => ({ default: { list: vi.fn(async () => ({ items: [], unread_count: 0 })) } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: vi.fn(async () => []) } }));
vi.mock('../../src/services/roomService', () => ({ default: { list: vi.fn(async () => []), listPage: vi.fn(async () => ({ items: [], total: 0 })) } }));
vi.mock('../../src/services/friendService', () => ({ default: { list: vi.fn(async () => []) } }));
vi.mock('../../src/services/userService', () => ({ default: { get: vi.fn(async id => ({ id: Number(id), user_name: 'Bob', bio: null, created_at: '2026-03-04T10:00:00Z' })), listByIds: vi.fn(async () => []), getMe: vi.fn() } }));
vi.mock('../../src/services/ratingService', () => ({ default: { getForUser: vi.fn(async () => ({ user_id: 2, average_rating: null, rating_count: 0 })) } }));

const show = (path = '/') => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
const signOutNow = async user => {
  await user.click(await screen.findByRole('button', { name: 'Alice' }));
  await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
};

beforeEach(() => {
  state.sessions.clear();
  state.signedIn = true;
  state.offline = false;
  state.retry.mockClear();
  // Like the real signOut, this clears the session; no act() here because user-event already wraps the click in one.
  state.signOut = vi.fn(async () => { for (const callback of state.sessions) callback({ user: null, loading: false, error: null }); });
});

describe('page chrome and accessibility', () => {
  it('starts with a skip link that targets the focusable content area', () => {
    show();
    const link = screen.getByRole('link', { name: 'Skip to content' });
    expect(link).toHaveAttribute('href', '#main-content');
    expect(document.querySelector('a[href], button, input, select, textarea')).toBe(link);
    const target = document.getElementById('main-content');
    expect(target).toHaveAttribute('tabindex', '-1');
    expect(target).toContainElement(screen.getByRole('main'));
  });

  it.each([['/', 'Home'], ['/sports', 'Find games'], ['/cups/4', 'Cup'], ['/rooms/new', 'Host a room'], ['/users/2', 'Profile'], ['/messages/direct/2', 'Messages'], ['/nowhere', 'Page not found']])('titles %s as "%s"', (path, title) => {
    show(path);
    expect(document.title).toBe(`${title} · Modeer Almalaaeb`);
  });

  it('gives each page its own title and moves focus to the content after following a link', async () => {
    const user = userEvent.setup();
    show('/');
    await user.click(screen.getByRole('link', { name: 'Find games' }));
    await waitFor(() => expect(document.title).toBe('Find games · Modeer Almalaaeb'));
    expect(document.getElementById('main-content')).toHaveFocus();
  });
});

describe('signing out', () => {
  it.each(['/friends', '/my-rooms', '/settings'])('lands on Home, not the sign-in page, when you sign out from %s', async path => {
    const user = userEvent.setup();
    show(path);
    await signOutNow(user);
    expect(await screen.findByRole('heading', { name: 'Your next game starts here' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(state.signOut).toHaveBeenCalledOnce();
  });

  it('warns at app level when the server could not confirm the logout, and still signs you out on this device', async () => {
    const user = userEvent.setup();
    state.signOut = vi.fn(async () => {
      for (const callback of state.sessions) callback({ user: null, loading: false, error: null });
      throw new Error('Network down');
    });
    show('/friends');
    await signOutNow(user);
    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent('You were signed out on this device, but the server could not confirm it.');
    expect(screen.getByRole('heading', { name: 'Your next game starts here' })).toBeVisible();
    await user.click(within(warning).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('server status notices', () => {
  it('says the server is waking up while requests are slow, and stops once it answers', async () => {
    show('/');
    expect(screen.queryByText(/waking up/)).not.toBeInTheDocument();
    await act(async () => state.wake(true));
    expect(screen.getByText('The server is waking up, this can take up to a minute.')).toBeVisible();
    await act(async () => state.wake(false));
    expect(screen.queryByText(/waking up/)).not.toBeInTheDocument();
  });

  it('explains an unconfirmed sign-in, retries on request, and does not send a restoring visitor to sign in', async () => {
    const user = userEvent.setup();
    state.offline = true;
    show('/friends');
    expect(screen.getByText(/could not check your sign-in yet/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try now' }));
    expect(state.retry).toHaveBeenCalledOnce();
  });
});

describe('public profiles', () => {
  it('lets a guest open a profile without being sent to sign in', async () => {
    state.signedIn = false;
    show('/users/2');
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeVisible();
    expect(screen.getByText('Member since 4 March 2026')).toBeVisible();
    await waitFor(() => expect(screen.getByText('No ratings yet')).toBeVisible());
  });
});
