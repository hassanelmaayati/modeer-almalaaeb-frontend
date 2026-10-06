import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { initialSession, watchUser, authenticate, signOut } from '../../src/lib/helpers/auth.js';
import SignInForm from '../../src/components/auth/SignInForm.jsx';
import SignUpForm from '../../src/components/auth/SignUpForm.jsx';
import * as authService from '../../src/services/authService.js';
import * as userService from '../../src/services/userService.js';
import { clearToken, getToken, setToken } from '../../src/lib/helpers/session.js';

vi.mock('../../src/services/userService.js', () => ({ getMe: vi.fn() }));
vi.mock('../../src/services/authService.js', () => ({ signIn: vi.fn(), signUp: vi.fn(), logout: vi.fn() }));

const alice = { id: 1, user_name: 'Alice' };
const bob = { id: 2, user_name: 'Bob' };
const makeToken = (id) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: String(id), exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
let currentSession;

function SessionProbe() {
  const [session, setSession] = useState(initialSession);
  useEffect(() => watchUser(setSession), []);
  useEffect(() => {
    currentSession = {
      ...session,
      signIn: (body) => authenticate(authService.signIn, body, setSession),
      signUp: (body) => authenticate(authService.signUp, body, setSession),
      signOut,
    };
  }, [session]);
  return <><p data-testid="profile">{session.loading ? 'loading' : session.user?.user_name || 'guest'}</p>{session.error && <p role="alert">{session.error.message}</p>}</>;
}

function renderProvider() {
  return render(<SessionProbe />);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  clearToken();
  vi.resetAllMocks();
  userService.getMe.mockResolvedValue(alice);
  authService.signIn.mockResolvedValue({ token: makeToken(2), msg: 'Login successful', user: bob });
  authService.signUp.mockResolvedValue({ token: makeToken(2), msg: 'User registered successfully', user: bob });
  authService.logout.mockResolvedValue(null);
});

describe('authoritative account restoration and session changes', () => {
  it('uses /users/me rather than exposing JWT claims as the profile', async () => {
    setToken(makeToken(1));
    renderProvider();
    await screen.findByText('Alice');
    expect(userService.getMe).toHaveBeenCalledTimes(1);
    expect(currentSession.user).toEqual(alice);
  });

  it('does not restore an old profile when logout happens during restoration', async () => {
    const restoration = deferred();
    userService.getMe.mockReturnValue(restoration.promise);
    setToken(makeToken(1));
    renderProvider();
    expect(screen.getByTestId('profile')).toHaveTextContent('loading');
    await waitFor(() => expect(userService.getMe).toHaveBeenCalledTimes(1));
    act(() => clearToken());
    expect(screen.getByTestId('profile')).toHaveTextContent('guest');
    expect(userService.getMe.mock.calls[0][0].signal.aborted).toBe(true);
    await act(async () => { restoration.resolve(alice); await restoration.promise; });
    expect(screen.getByTestId('profile')).toHaveTextContent('guest');
    expect(getToken()).toBeNull();
  });

  it('restores a newly signed-in account when another tab changes the token', async () => {
    renderProvider();
    expect(screen.getByTestId('profile')).toHaveTextContent('guest');
    userService.getMe.mockResolvedValue(bob);
    const replacement = makeToken(2);
    act(() => {
      window.localStorage.setItem('token', replacement);
      window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: replacement }));
    });
    await screen.findByText('Bob');
    expect(currentSession.user).toEqual(bob);
  });

  it('keeps a new login when an older profile request resolves late', async () => {
    const oldRestoration = deferred();
    userService.getMe.mockReturnValueOnce(oldRestoration.promise).mockResolvedValue(bob);
    setToken(makeToken(1));
    renderProvider();
    await act(async () => { await currentSession.signIn({ email: 'bob@example.test', password: 'TestPass123!' }); });
    await act(async () => { oldRestoration.resolve(alice); await oldRestoration.promise; });
    expect(screen.getByTestId('profile')).toHaveTextContent('Bob');
    expect(getToken()).toBe((await authService.signIn.mock.results[0].value).token);
  });

  it('clears the local session when backend logout fails', async () => {
    setToken(makeToken(1));
    renderProvider();
    await screen.findByText('Alice');
    authService.logout.mockRejectedValue(new Error('Server unavailable'));
    await act(async () => { await expect(currentSession.signOut()).rejects.toThrow('Server unavailable'); });
    expect(getToken()).toBeNull();
    expect(screen.getByTestId('profile')).toHaveTextContent('guest');
  });

  it('does not clear a newer login when an older logout finishes', async () => {
    const oldLogout = deferred();
    authService.logout.mockReturnValue(oldLogout.promise);
    setToken(makeToken(1));
    renderProvider();
    await screen.findByText('Alice');
    let signingOut;
    act(() => { signingOut = currentSession.signOut(); });
    userService.getMe.mockResolvedValue(bob);
    await act(async () => { await currentSession.signIn({ email: 'bob@example.test', password: 'TestPass123!' }); });
    await act(async () => { oldLogout.resolve(null); await signingOut; });
    expect(getToken()).toBe((await authService.signIn.mock.results[0].value).token);
    expect(screen.getByTestId('profile')).toHaveTextContent('Bob');
  });

  it('clears the visible account when its token expires while the page stays open', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
      setToken(makeToken(1));
      renderProvider();
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByTestId('profile')).toHaveTextContent('Alice');
      await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60 * 1000); });
      expect(getToken()).toBeNull();
      expect(screen.getByTestId('profile')).toHaveTextContent('guest');
    } finally {
      vi.useRealTimers();
    }
  });
});

function renderAuth(Form, state, session) {
  return render(<MemoryRouter initialEntries={[{ pathname: '/auth', state }]}><Routes><Route path="/auth" element={<Form session={{ user: null, loading: false, ...session }} />} /><Route path="/groups" element={<p>Returned to groups</p>} /><Route path="/" element={<p>Returned home</p>} /></Routes></MemoryRouter>);
}

describe('backend-compatible authentication forms', () => {
  it('submits email credentials and returns home after an account change', async () => {
    const signIn = vi.fn().mockResolvedValue(bob);
    renderAuth(SignInForm, { from: '/groups' }, { signIn });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Returned home');
    expect(signIn).toHaveBeenCalledWith({ email: 'bob@example.test', password: 'TestPass123!' });
  });

  it('retains server validation errors and prevents duplicate login submits', async () => {
    const login = deferred();
    const signIn = vi.fn().mockReturnValue(login.promise);
    renderAuth(SignInForm, null, { signIn });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'badpassword' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    await act(async () => { login.reject(new Error('Invalid credentials')); });
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('checks confirmation before issuing a signup request', async () => {
    const signUp = vi.fn();
    renderAuth(SignUpForm, null, { signUp });
    fireEvent.change(screen.getByLabelText('User name'), { target: { value: 'Bob' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPass123!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different123!' } });
    fireEvent.change(screen.getByLabelText('Governorate'), { target: { value: 'capital' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords must match.');
    expect(signUp).not.toHaveBeenCalled();
  });

  it('submits backend user_name without the confirmation field', async () => {
    const signUp = vi.fn().mockResolvedValue(bob);
    renderAuth(SignUpForm, { from: '//example.test' }, { signUp });
    fireEvent.change(screen.getByLabelText('User name'), { target: { value: ' Bob ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'TestPass123!' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'TestPass123!' } });
    fireEvent.change(screen.getByLabelText('Governorate'), { target: { value: 'capital' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await screen.findByText('Returned home');
    expect(signUp).toHaveBeenCalledWith({ user_name: 'Bob', email: 'bob@example.test', password: 'TestPass123!', district: 'capital' });
  });
});
