import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import NavBar from '../../src/components/layout/NavBar';
import UserMenu from '../../src/components/layout/UserMenu';

const alice = { id: 1, user_name: 'Alice' };
const bob = { id: 2, user_name: 'Bob' };

function menu(props = {}) {
  const view = render(<MemoryRouter><UserMenu user={alice} onSignOut={vi.fn()} pending={false} {...props} /><button>Outside action</button></MemoryRouter>);
  return { ...view, user: userEvent.setup() };
}

describe('account menu keyboard and session boundaries', () => {
  it('keeps the account trigger named when the mobile layout hides its username', () => {
    render(<MemoryRouter><style>{'.user-menu-name { display: none; }'}</style><UserMenu user={alice} onSignOut={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('button')).toHaveAccessibleName('Alice');
  });

  it('opens on click with focus inside the menu and restores trigger focus on Escape', async () => {
    const { user } = menu();
    const trigger = screen.getByRole('button', { name: 'Alice' });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'My rooms' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens from the keyboard and wraps arrow navigation with Home and End', async () => {
    const { user } = menu();
    screen.getByRole('button', { name: 'Alice' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'My rooms' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Joined rooms' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'My rooms' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'My rooms' })).toHaveFocus();
  });

  it('ArrowUp opens at the last enabled item and skips a pending sign-out button', async () => {
    const { user } = menu({ pending: true });
    screen.getByRole('button', { name: 'Alice' }).focus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'Signing out…' })).toBeDisabled();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'My rooms' })).toHaveFocus();
  });

  it('closes on Tab while letting keyboard focus reach the next control', async () => {
    const { user } = menu();
    await user.click(screen.getByRole('button', { name: 'Alice' }));
    await user.tab();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outside action' })).toHaveFocus();
  });

  it('closes on an outside click without stealing focus back from that control', async () => {
    const { user } = menu();
    await user.click(screen.getByRole('button', { name: 'Alice' }));
    await user.click(screen.getByRole('button', { name: 'Outside action' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Outside action' })).toHaveFocus();
  });

  it('closes when navigating to an account destination', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><UserMenu user={alice} onSignOut={vi.fn()} /><Routes>
      <Route path="/settings" element={<p>Account settings destination</p>} />
      <Route path="*" element={null} />
    </Routes></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Alice' }));
    await user.click(screen.getByRole('menuitem', { name: 'Profile' }));
    expect(screen.getByText('Account settings destination')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('resets an open menu when switching accounts, including switching back', async () => {
    const user = userEvent.setup();
    const view = render(<MemoryRouter><UserMenu user={alice} onSignOut={vi.fn()} /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: 'Alice' }));
    view.rerender(<MemoryRouter><UserMenu user={bob} onSignOut={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bob' })).toHaveAttribute('aria-expanded', 'false');
    view.rerender(<MemoryRouter><UserMenu user={alice} onSignOut={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes before invoking sign out exactly once', async () => {
    const onSignOut = vi.fn();
    const { user } = menu({ onSignOut });
    await user.click(screen.getByRole('button', { name: 'Alice' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('navigation logout isolation', () => {
  function nav(user, signOut) {
    return <MemoryRouter><NavBar session={{ user, loading: false, signOut }} /></MemoryRouter>;
  }

  it('reports a failed logout to its current account and clears it after switching', async () => {
    const user = userEvent.setup();
    const signOut = vi.fn().mockRejectedValue(new Error('Offline'));
    const view = render(nav(alice, signOut));
    await user.click(screen.getByRole('button', { name: 'Alice' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The server could not confirm logout.');
    view.rerender(nav(bob, signOut));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not carry pending state or late logout failures into a new account', async () => {
    const user = userEvent.setup();
    let rejectLogout;
    const signOut = vi.fn(() => new Promise((resolve, reject) => { rejectLogout = reject; }));
    const view = render(nav(alice, signOut));
    await user.click(screen.getByRole('button', { name: 'Alice' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    view.rerender(nav(bob, signOut));
    await user.click(screen.getByRole('button', { name: 'Bob' }));
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeEnabled();
    await act(async () => rejectLogout(new Error('Late logout failure')));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
