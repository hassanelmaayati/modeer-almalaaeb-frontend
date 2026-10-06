import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const base = {
  sport_id: 1,
  visibility: 'public',
  difficulty: 'medium',
  starts_at: '2026-10-10T15:00:00Z',
  ends_at: '2026-10-10T16:00:00Z',
  capacity: 10,
  slots_left: 4,
  district: 'capital',
  area: 'Manama',
  description: null,
};
const membership = (status, requested = true, extra = {}) => ({ status, requested, position: null, attendance: null, ...extra });
const rows = {
  upcoming: [{ ...base, id: 1, title: 'Seated game', status: 'open', venue_notes: 'Gate 2', membership: membership('accepted', true, { position: 'goalkeeper' }) }],
  past: [{ ...base, id: 6, title: 'Finished game', status: 'completed', membership: membership('accepted') }],
  requests: [{ ...base, id: 2, title: 'Asked game', status: 'open', membership: membership('pending', true) }],
  invitations: [{ ...base, id: 3, title: 'Invited game', status: 'open', membership: membership('pending', false) }],
  other: [
    { ...base, id: 4, title: 'Declined game', status: 'open', membership: membership('declined') },
    { ...base, id: 5, title: 'Left game', status: 'completed', membership: membership('left', null) },
  ],
};

const listJoined = vi.fn();
let socketHandler = null;
vi.mock('../../src/services/roomService', () => ({ default: { listJoined: (...args) => listJoined(...args) } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: async () => [{ id: 1, name: 'Football' }, { id: 2, name: 'Swimming' }] } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: (callback) => {
    socketHandler = callback;
    return () => { socketHandler = null; };
  },
}));
const { default: JoinedRoomsPage } = await import('../../src/pages/JoinedRoomsPage');

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

const mount = (start = '/joined-rooms') => render(
  <MemoryRouter initialEntries={[start]}>
    <Routes>
      <Route path="/joined-rooms" element={<><JoinedRoomsPage /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);

const url = () => screen.getByTestId('where').textContent;
const lastQuery = () => listJoined.mock.calls.at(-1)[0];
const checked = (names) => names.filter((name) => screen.getByLabelText(name).checked);
const cards = () => [...document.querySelectorAll('article')].map((card) => ({
  title: card.querySelector('h3').textContent,
  badges: [...card.querySelectorAll('.status-badge')].map((badge) => badge.textContent),
  muted: card.className.includes('is-muted'),
  text: card.textContent,
}));
const send = (event) => act(async () => { socketHandler(event); });

let invited;
beforeEach(() => {
  invited = false;
  listJoined.mockReset();
  listJoined.mockImplementation(async (query) => {
    const wanted = query.membership ?? [];
    let items = rows.upcoming;
    if (wanted.includes('declined')) items = rows.other;
    else if (wanted.includes('pending')) items = query.requested === 'false' ? (invited ? rows.invitations : []) : rows.requests;
    else if (query.status?.includes('completed')) items = rows.past;
    return { items, total: items.length, limit: 20, offset: 0, has_more: false };
  });
});

describe('Joined rooms page', () => {
  it('opens on the upcoming view', async () => {
    mount();
    await screen.findByText('Seated game');
    expect(lastQuery()).toEqual({ membership: ['accepted'], status: ['open', 'started'], order: 'asc', limit: 20, offset: 0 });
    expect(checked(['Accepted', 'Pending', 'Declined', 'Removed', 'Left'])).toEqual(['Accepted']);
    expect(screen.getByLabelText('Sort')).toHaveValue('asc');
  });

  it('sends the right filters for every view', async () => {
    mount();
    await screen.findByText('Seated game');
    const expectations = [
      ['Past', 'Finished game', { membership: ['accepted'], status: ['completed', 'cancelled'], order: 'desc' }, '/joined-rooms?view=past'],
      ['Requests', 'Asked game', { membership: ['pending'], status: ['open', 'started'], order: 'asc', requested: 'true' }, '/joined-rooms?view=requests'],
      ['Other', 'Declined game', { membership: ['declined', 'removed', 'left'], status: [], order: 'desc' }, '/joined-rooms?view=other'],
    ];
    for (const [tab, title, query, path] of expectations) {
      await userEvent.click(screen.getByRole('link', { name: tab }));
      await screen.findByText(title);
      expect(lastQuery()).toEqual({ ...query, limit: 20, offset: 0 });
      expect(url()).toBe(path);
    }
    expect(checked(['Accepted', 'Pending', 'Declined', 'Removed', 'Left'])).toEqual(['Declined', 'Removed', 'Left']);
    expect(checked(['Open', 'Started', 'Completed', 'Cancelled'])).toEqual([]);
  });

  it('shows the request type of the requests and invitations views', async () => {
    invited = true;
    mount('/joined-rooms?view=requests');
    await screen.findByText('Asked game');
    expect(screen.getByLabelText('Request type')).toHaveValue('true');
    await userEvent.click(screen.getByRole('link', { name: 'Invitations' }));
    await screen.findByText('Invited game');
    expect(screen.getByLabelText('Request type')).toHaveValue('false');
    expect(lastQuery()).toMatchObject({ membership: ['pending'], requested: 'false' });
  });

  it('describes each membership on its card', async () => {
    mount('/joined-rooms?view=other');
    await screen.findByText('Declined game');
    const [declined, left] = cards();
    expect(declined).toMatchObject({ badges: ['Declined', 'Open', 'Medium'], muted: true });
    expect(left).toMatchObject({ badges: ['Left', 'Completed', 'Medium'], muted: true });
  });

  it('shows the position, the meeting details and a link for an accepted room', async () => {
    mount();
    await screen.findByText('Seated game');
    const [card] = cards();
    expect(card.badges).toEqual(['Accepted', 'Open', 'Medium']);
    expect(card.text).toContain('Your position: goalkeeper');
    expect(card.text).toContain('Meeting details: Gate 2');
    expect(card.muted).toBe(false);
    expect(screen.getByRole('link', { name: 'View room' })).toHaveAttribute('href', '/rooms/1');
  });

  it('writes applied filters to the URL and clears back to upcoming', async () => {
    mount('/joined-rooms?view=other');
    await screen.findByText('Declined game');
    await userEvent.click(screen.getByLabelText('Removed'));
    await userEvent.selectOptions(screen.getByLabelText('Activity'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(url()).toBe('/joined-rooms?view=other&membership=declined&membership=left&sport_id=2');
    expect(lastQuery()).toMatchObject({ membership: ['declined', 'left'], sport_id: '2' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(url()).toBe('/joined-rooms');
  });

  it('reloads on a personal room event and ignores lobby events', async () => {
    mount('/joined-rooms?view=invitations');
    await screen.findByText('No invitations');
    const calls = listJoined.mock.calls.length;
    for (const event of [{ type: 'room_created', room: { id: 9 } }, { type: 'room_updated', room: { id: 9 } }, { type: 'room_removed', room_id: 9 }, { type: 'lobby.ready' }, { type: 'message.created' }]) await send(event);
    expect(listJoined).toHaveBeenCalledTimes(calls);
    invited = true;
    await send({ type: 'room.updated', room_id: 3 });
    await screen.findByText('Invited game');
    expect(listJoined).toHaveBeenCalledTimes(calls + 1);
    await send({ type: 'connection.ready' });
    expect(listJoined).toHaveBeenCalledTimes(calls + 2);
  });
});

describe('Joined rooms empty states', () => {
  beforeEach(() => {
    listJoined.mockReset();
    listJoined.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0, has_more: false });
  });

  const emptyState = async (start) => {
    mount(start);
    const heading = await screen.findByRole('heading', { level: 3 });
    const action = heading.parentElement.querySelector('a, button');
    return { title: heading.textContent, action: action ? action.textContent : null, href: action?.getAttribute('href') ?? null };
  };

  it('offers browsing activities when nothing is joined or requested', async () => {
    expect(await emptyState('/joined-rooms')).toMatchObject({ title: "You haven't joined any upcoming rooms", action: 'Browse activities', href: '/sports' });
  });

  it('offers browsing activities on the requests view', async () => {
    expect(await emptyState('/joined-rooms?view=requests')).toMatchObject({ title: 'No pending requests', action: 'Browse activities' });
  });

  it('has no action on past, invitations and other', async () => {
    expect(await emptyState('/joined-rooms?view=past')).toMatchObject({ title: 'No past rooms yet', action: null });
  });

  it('has no action on invitations', async () => {
    expect(await emptyState('/joined-rooms?view=invitations')).toMatchObject({ title: 'No invitations', action: null });
  });

  it('offers clearing when a filter is set', async () => {
    mount('/joined-rooms?view=other&sport_id=1');
    await screen.findByText('No rooms match these filters');
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1));
    expect(url()).toBe('/joined-rooms');
  });
});
