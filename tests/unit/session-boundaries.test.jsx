import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RequireAuth from '../../src/components/auth/RequireAuth';
import SignInForm from '../../src/components/auth/SignInForm';
import { clearToken, decodeToken, getToken, setToken, subscribeSession } from '../../src/lib/helpers/session';

const now = Date.parse('2030-01-01T12:00:00Z');
const token = payload => 'header.' + btoa(JSON.stringify(payload)) + '.signature';
const valid = () => token({ sub: '1', exp: now / 1000 + 60 });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); clearToken(); });
afterEach(() => { clearToken(); vi.useRealTimers(); });

describe('persisted session validity boundaries', () => {
  it.each([
    null, '', 'two.parts', 'header.invalid%base64.signature',
    token(null), token([]), token('claims'),
    token({ sub: '1' }), token({ sub: '1', exp: '1893499260' }),
    token({ sub: '-1', exp: now / 1000 + 60 }),
    token({ sub: '1e2', exp: now / 1000 + 60 }),
    token({ sub: '1', exp: now / 1000 }),
  ])('rejects an invalid or expired session payload %s without restoring a user', value => {
    expect(decodeToken(value)).toBeNull();
    if (value) window.localStorage.setItem('token', value);
    expect(getToken()).toBeNull();
    expect(window.localStorage.getItem('token')).toBeNull();
  });
  it('accepts an unexpired numeric subject and expires it exactly at the recorded second', async () => {
    const listener = vi.fn();
    const stop = subscribeSession(listener);
    setToken(valid());
    expect(getToken()).toBe(valid());
    await vi.advanceTimersByTimeAsync(59_999);
    expect(getToken()).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);
    stop();
  });
  it('leaves a valid session untouched when a server returns malformed replacement credentials', () => {
    setToken(valid());
    expect(() => setToken('broken')).toThrow(/invalid or expired session/);
    expect(getToken()).toBe(valid());
  });
  it('handles URL-safe JWT payloads containing Unicode profile data without using them as identity', () => {
    const payload = { sub: '1', exp: now / 1000 + 60, label: 'مرحبا' };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    const encoded = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    expect(decodeToken('header.' + encoded + '.signature')).toEqual(payload);
  });
  it('listens only for relevant token storage events and stops receiving changes after unsubscribe', () => {
    const listener = vi.fn();
    const stop = subscribeSession(listener);
    window.localStorage.setItem('token', valid());
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated' }));
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'token' }));
    expect(listener).toHaveBeenCalledWith(valid());
    stop();
    clearToken();
    expect(listener).toHaveBeenCalledOnce();
  });
  it('reacts to another tab clearing all persisted storage', () => {
    setToken(valid());
    const listener = vi.fn(), stop = subscribeSession(listener);
    window.localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    expect(listener).toHaveBeenCalledWith(null);
    expect(getToken()).toBeNull();
    stop();
  });
});

describe('protected route restoration and auth destinations', () => {
  function show(session) {
    return render(<MemoryRouter initialEntries={['/private']}><Routes>
      <Route path="/private" element={<RequireAuth session={session}><p>Private account data</p></RequireAuth>} />
      <Route path="/sign-in" element={<p>Sign in page</p>} />
    </Routes></MemoryRouter>);
  }
  it('waits for authoritative restoration before showing private data or redirecting', () => {
    show({ loading: true, user: null });
    expect(screen.getByRole('status')).toHaveTextContent('Restoring session…');
    expect(screen.queryByText('Private account data')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign in page')).not.toBeInTheDocument();
  });
  it('redirects a guest to sign-in without rendering private children', () => {
    show({ loading: false, user: null });
    expect(screen.getByText('Sign in page')).toBeVisible();
    expect(screen.queryByText('Private account data')).not.toBeInTheDocument();
  });
  it('admits a restored account', () => {
    show({ loading: false, user: { id: 1 } });
    expect(screen.getByText('Private account data')).toBeVisible();
  });
  it('returns an already signed-in visitor home instead of rendering another login form', async () => {
    await act(async () => render(<MemoryRouter initialEntries={['/sign-in']}><Routes>
      <Route path="/sign-in" element={<SignInForm session={{ loading: false, user: { id: 1 } }} />} />
      <Route path="/" element={<p>Home page</p>} />
    </Routes></MemoryRouter>));
    expect(screen.getByText('Home page')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
