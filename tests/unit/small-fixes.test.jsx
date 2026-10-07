import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CupCard from '../../src/components/cups/CupCard';
import MyRoomCard from '../../src/components/activities/MyRoomCard';
import JoinedRoomCard from '../../src/components/activities/JoinedRoomCard';
import PlayerProfile from '../../src/components/users/PlayerProfile';
import AppNotices from '../../src/components/layout/AppNotices';
import { newClientId } from '../../src/lib/helpers/uuid';
import { formatLongDate } from '../../src/lib/helpers/date';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
afterEach(() => vi.unstubAllGlobals());

describe('client ids for messages', () => {
  it('uses crypto.randomUUID when the browser provides it', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-id' });
    expect(newClientId()).toBe('fixed-id');
  });
  it('builds a valid v4 UUID without randomUUID (plain-http pages), unique each time', () => {
    vi.stubGlobal('crypto', { getRandomValues: bytes => { for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256); return bytes; } });
    const ids = new Set(Array.from({ length: 50 }, newClientId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID);
  });
  it('still works with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    expect(newClientId()).toMatch(UUID);
  });
});

describe('cup cards', () => {
  const cup = (status) => ({ id: 1, name: 'Spring cup', status, format: 'knockout', team_count: 4, roster_limit: 5, registration_closes_at: '2030-01-02T12:00:00Z', organizer: { id: 2, user_name: 'Bob' } });
  const show = (status) => render(<MemoryRouter><CupCard cup={cup(status)} sportName="Football" /></MemoryRouter>);
  it.each(['draft', 'registration'])('shows when registration closes for a %s cup', (status) => {
    show(status);
    expect(screen.getByText('Registration closes')).toBeVisible();
  });
  it.each(['published', 'completed'])('does not mention a registration deadline for a %s cup', (status) => {
    show(status);
    expect(screen.queryByText('Registration closes')).not.toBeInTheDocument();
  });
});

describe('room cards without slots_left', () => {
  const room = (extra) => ({ id: 1, title: 'Game', starts_at: '2030-10-10T15:00:00Z', ends_at: '2030-10-10T16:00:00Z', area: 'Manama', district: 'capital', difficulty: 'beginners', visibility: 'public', capacity: 10, status: 'open', membership: { status: 'accepted' }, ...extra });
  it.each([[MyRoomCard], [JoinedRoomCard]])('says "N places", never "undefined of N", when the count is missing', (Card) => {
    const { unmount } = render(<MemoryRouter><Card room={room({})} sportName="Football" /></MemoryRouter>);
    expect(screen.getByText('10 places')).toBeVisible();
    expect(document.body).not.toHaveTextContent(/undefined|null/);
    unmount();
    render(<MemoryRouter><Card room={room({ slots_left: null })} sportName="Football" /></MemoryRouter>);
    expect(screen.getByText('10 places')).toBeVisible();
  });
  it.each([[MyRoomCard], [JoinedRoomCard]])('still quotes the places left when it is known', (Card) => {
    render(<MemoryRouter><Card room={room({ slots_left: 4 })} sportName="Football" /></MemoryRouter>);
    expect(screen.getByText('4 of 10 places left')).toBeVisible();
  });
});

describe('member since', () => {
  it('shows the year, in Bahrain time', () => {
    expect(formatLongDate('2026-03-04T10:00:00')).toBe('4 March 2026');
    expect(formatLongDate('2025-12-31T22:30:00Z')).toBe('1 January 2026');
    expect(formatLongDate(null)).toBe('Date unavailable');
    render(<PlayerProfile user={{ id: 2, user_name: 'Bob', bio: null, created_at: '2024-11-20T08:00:00Z' }} />);
    expect(screen.getByText('Member since 20 November 2024')).toBeVisible();
  });
});

describe('app notices', () => {
  it('renders nothing when all is well', () => {
    const { container } = render(<AppNotices waking={false} offline={false} notice="" />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows one status line at a time for a slow server or an unconfirmed sign-in, the sign-in one winning', () => {
    const { rerender } = render(<AppNotices waking offline={false} notice="" />);
    expect(screen.getByRole('status')).toHaveTextContent('The server is waking up, this can take up to a minute.');
    rerender(<AppNotices waking offline notice="" onRetry={() => {}} />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('could not check your sign-in yet');
  });
  it('announces a warning as an alert with a way to dismiss it', () => {
    render(<AppNotices waking={false} offline={false} notice="Careful" onDismiss={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Careful');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeVisible();
  });
});
