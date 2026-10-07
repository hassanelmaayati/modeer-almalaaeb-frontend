import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import process from 'node:process';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeToggle from '../../src/components/layout/ThemeToggle';
import NavBar from '../../src/components/layout/NavBar';
import { THEME_KEY, THEME_QUERY } from '../../src/lib/helpers/theme';

const read = file => readFileSync(path.resolve(process.cwd(), file), 'utf8');
const startup = read('public/theme-init.js');
let media;

function deviceTheme(dark = false) {
  const listeners = new Set();
  const query = {
    matches: dark,
    addEventListener: vi.fn((type, listener) => listeners.add(listener)),
    removeEventListener: vi.fn((type, listener) => listeners.delete(listener)),
    change(matches) {
      query.matches = matches;
      act(() => { for (const listener of listeners) listener({ matches }); });
    },
    listeners,
  };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  media = query;
  return query;
}

function expectTheme(dark) {
  expect(screen.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute('aria-pressed', String(dark));
  expect(document.documentElement.classList.contains('dark')).toBe(dark);
  expect(document.documentElement.style.colorScheme).toBe(dark ? 'dark' : 'light');
}

const guest = { user: null, loading: false, signOut: vi.fn() };
const owner = { user: { id: 1, user_name: 'Owner' }, loading: false, signOut: vi.fn() };
function navigation(session = guest) {
  return <MemoryRouter><NavBar session={session} /><Routes>
    <Route path="/sports" element={<p>Sports destination</p>} />
    <Route path="*" element={null} />
  </Routes></MemoryRouter>;
}

beforeEach(() => { deviceTheme(); });
afterEach(() => { document.querySelector('meta[name="theme-color"]')?.remove(); });

describe('theme initialization before the app loads', () => {
  it.each([
    [null, false, false], [null, true, true], ['light', true, false], ['dark', false, true], ['invalid', true, true],
  ])('resolves saved %s with device dark=%s before rendering', (saved, deviceDark, expected) => {
    runInNewContext(startup, {
      window: { localStorage: { getItem: () => saved }, matchMedia: () => ({ matches: deviceDark }) }, document,
    });
    expect(document.documentElement.classList.contains('dark')).toBe(expected);
    expect(document.documentElement.style.colorScheme).toBe(expected ? 'dark' : 'light');
  });

  it('falls back to the device when accessing storage throws', () => {
    const browser = { matchMedia: () => ({ matches: true }) };
    Object.defineProperty(browser, 'localStorage', { get() { throw new Error('Storage disabled'); } });
    runInNewContext(startup, { window: browser, document });
    expect(document.documentElement).toHaveClass('dark');
  });

  it('uses light when both storage and media-query APIs are unavailable', () => {
    runInNewContext(startup, { window: {}, document });
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('loads the external initializer before the app module without loosening script CSP', () => {
    const html = read('index.html');
    expect(html).toContain('<script src="/theme-init.js"></script>');
    expect(html.indexOf('<script src="/theme-init.js"></script>')).toBeLessThan(html.indexOf('<body>'));
    expect(html).not.toMatch(/<script[^>]*(?:async|defer)[^>]*src="\/theme-init.js"/);
    const config = JSON.parse(read('vercel.json'));
    const csp = config.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value;
    expect(csp.match(/script-src[^;]+/)[0]).not.toMatch(/unsafe-inline|unsafe-eval/);
  });
});

describe('browser theme preference and accessible toggle', () => {
  it.each([false, true])('starts with the device theme dark=%s and follows subsequent changes', dark => {
    deviceTheme(dark);
    render(<ThemeToggle />);
    expectTheme(dark);
    expect(window.matchMedia).toHaveBeenCalledWith(THEME_QUERY);
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
    media.change(!dark);
    expectTheme(!dark);
  });

  it.each(['light', 'dark'])('restores saved %s and ignores device changes', saved => {
    window.localStorage.setItem(THEME_KEY, saved);
    deviceTheme(saved !== 'dark');
    render(<ThemeToggle />);
    expectTheme(saved === 'dark');
    media.change(saved === 'dark');
    expectTheme(saved === 'dark');
  });

  it('ignores invalid saved values instead of treating them as a theme', () => {
    window.localStorage.setItem(THEME_KEY, 'broken');
    deviceTheme(true);
    render(<ThemeToggle />);
    expectTheme(true);
    media.change(false);
    expectTheme(false);
  });

  it('toggles with Space and Enter, keeps focus, saves the choice and restores it on remount', async () => {
    const user = userEvent.setup();
    const view = render(<ThemeToggle />);
    const toggle = screen.getByRole('button', { name: 'Dark mode' });
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('title', 'Switch to dark mode');
    toggle.focus();
    await user.keyboard(' ');
    expectTheme(true);
    expect(toggle).toHaveFocus();
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(toggle).toHaveAttribute('title', 'Switch to light mode');
    media.change(false);
    expectTheme(true);
    await user.keyboard('{Enter}');
    expectTheme(false);
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
    view.unmount();
    deviceTheme(true);
    render(<ThemeToggle />);
    expectTheme(false);
  });

  it('keeps a choice in memory when reads and writes are blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage disabled'); });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expectTheme(true);
    media.change(false);
    expectTheme(true);
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expectTheme(false);
  });

  it('synchronizes other tabs and resumes device preference when the saved choice is removed', () => {
    render(<ThemeToggle />);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'dark', storageArea: window.localStorage })));
    expectTheme(true);
    media.change(false);
    expectTheme(true);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: null })));
    expectTheme(false);
    media.change(true);
    expectTheme(true);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'light' })));
    expectTheme(false);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })));
    expectTheme(true);
  });

  it('ignores unrelated keys and sessionStorage changes', () => {
    render(<ThemeToggle />);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: 'dark' })));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY, newValue: 'dark', storageArea: window.sessionStorage })));
    expectTheme(false);
  });

  it('removes media and storage listeners when unmounted', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const view = render(<ThemeToggle />);
    expect(media.listeners.size).toBe(1);
    view.unmount();
    expect(media.listeners.size).toBe(0);
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  it('updates the browser chrome color with the theme', async () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    const user = userEvent.setup();
    render(<ThemeToggle />);
    expect(meta.content).toBe('#14594a');
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(meta.content).toBe('#001e2b');
  });

  it('stays available and keeps the theme through navigation, account changes and sign-out', async () => {
    const user = userEvent.setup();
    const view = render(navigation());
    await user.click(screen.getByRole('button', { name: 'Dark mode' }));
    await user.click(screen.getByRole('link', { name: 'Find games' }));
    expect(screen.getByText('Sports destination')).toBeInTheDocument();
    expectTheme(true);
    view.rerender(navigation({ ...guest, loading: true }));
    expectTheme(true);
    expect(screen.getByText('Restoring session…')).toBeInTheDocument();
    view.rerender(navigation(owner));
    expectTheme(true);
    await user.click(screen.getByRole('button', { name: 'Owner', exact: true }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(owner.signOut).toHaveBeenCalledOnce();
    view.rerender(navigation(guest));
    expectTheme(true);
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
  });
});
