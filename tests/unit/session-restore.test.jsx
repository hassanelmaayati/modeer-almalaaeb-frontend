import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchUser } from '../../src/lib/helpers/auth.js';
import * as userService from '../../src/services/userService.js';
import { ApiError } from '../../src/lib/api/client.js';
import { clearToken, getToken, setToken } from '../../src/lib/helpers/session.js';

vi.mock('../../src/services/userService.js', () => ({ getMe: vi.fn() }));
vi.mock('../../src/services/authService.js', () => ({ logout: vi.fn(), signIn: vi.fn(), signUp: vi.fn() }));
const makeToken = id => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: String(id), exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
const alice = { id: 1, user_name: 'Alice' };
let states;
let stop;
const setSession = value => states.push(value);
const last = () => states.at(-1);

beforeEach(() => {
  vi.useFakeTimers();
  clearToken();
  states = [];
  userService.getMe.mockReset().mockResolvedValue(alice);
  setToken(makeToken(1));
});
afterEach(() => { stop?.(); stop = undefined; clearToken(); vi.useRealTimers(); });

const start = async () => { stop = watchUser(setSession); await vi.advanceTimersByTimeAsync(0); };

describe('restoring the session when the app opens', () => {
  it('signs the user in from the stored token', async () => {
    await start();
    expect(last()).toEqual({ user: alice, loading: false, error: null });
  });

  it('treats a rejected token (401) as signed out, with no retries', async () => {
    userService.getMe.mockRejectedValue(new ApiError('Token expired', { status: 401 }));
    await start();
    expect(last()).toMatchObject({ user: null, loading: false, error: { status: 401 } });
    expect(last().offline).toBeUndefined();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(userService.getMe).toHaveBeenCalledTimes(1);
  });

  it('does not retry other client errors forever (a 403 is an answer)', async () => {
    userService.getMe.mockRejectedValue(new ApiError('Forbidden', { status: 403 }));
    await start();
    expect(last()).toMatchObject({ user: null, loading: false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(userService.getMe).toHaveBeenCalledTimes(1);
  });

  it.each([['a network failure', new ApiError('The server is waking up', { status: 0 })], ['a 503', new ApiError('Unavailable', { status: 503 })], ['a 502', new ApiError('Bad gateway', { status: 502 })], ['a timeout (408)', new ApiError('Timeout', { status: 408 })]])('keeps the token and reports offline on %s, then signs in once the server answers', async (_name, failure) => {
    userService.getMe.mockRejectedValueOnce(failure).mockResolvedValue(alice);
    await start();
    // loading stays true so guarded pages wait instead of sending a signed-in person to the sign-in page
    expect(last()).toMatchObject({ user: null, loading: true, offline: true });
    expect(getToken()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(last()).toEqual({ user: alice, loading: false, error: null });
    expect(userService.getMe).toHaveBeenCalledTimes(2);
  });

  it('backs off between retries: 2 s, 4 s, 8 s', async () => {
    userService.getMe.mockRejectedValue(new ApiError('Down', { status: 503 }));
    await start();
    expect(userService.getMe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(userService.getMe).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(userService.getMe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3_999);
    expect(userService.getMe).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(userService.getMe).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(8_000);
    expect(userService.getMe).toHaveBeenCalledTimes(4);
    expect(getToken()).not.toBeNull();
  });

  it('retries straight away on request ("Try now")', async () => {
    userService.getMe.mockRejectedValueOnce(new ApiError('Down', { status: 503 })).mockResolvedValue(alice);
    await start();
    stop.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toEqual({ user: alice, loading: false, error: null });
  });

  it('stops retrying once the watcher is stopped', async () => {
    userService.getMe.mockRejectedValue(new ApiError('Down', { status: 503 }));
    await start();
    stop();
    stop = undefined;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(userService.getMe).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a stored token', async () => {
    clearToken();
    await start();
    expect(userService.getMe).not.toHaveBeenCalled();
    expect(last()).toEqual({ user: null, loading: false, error: null });
  });
});
