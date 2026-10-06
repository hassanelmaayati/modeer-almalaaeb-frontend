import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const room = (id, title, status = 'open') => ({
  id,
  title,
  status,
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
});

const listMine = vi.fn();
let socketHandler = null;
vi.mock('../../src/services/roomService', () => ({ default: { listMine: (...args) => listMine(...args) } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: async () => [{ id: 1, name: 'Football' }, { id: 2, name: 'Swimming' }] } }));
vi.mock('../../src/services/websocketService', () => ({
  listen: (callback) => {
    socketHandler = callback;
    return () => { socketHandler = null; };
  },
}));
const { default: MyRoomsPage } = await import('../../src/pages/MyRoomsPage');

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

const mount = (start = '/my-rooms') => render(
  <MemoryRouter initialEntries={[start]}>
    <Routes>
      <Route path="/my-rooms" element={<><MyRoomsPage session={{ user: { id: 1 }, loading: false }} /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);

const url = () => screen.getByTestId('where').textContent;
const lastQuery = () => listMine.mock.calls.at(-1)[0];
const titles = () => screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
const send = (event) => act(async () => { socketHandler(event); });

let extraRoom;
beforeEach(() => {
  extraRoom = false;
  listMine.mockReset();
  listMine.mockImplementation(async (query) => {
    if (query.status?.includes('completed')) return { items: [room(9, 'Old game', 'completed')], total: 1, limit: 20, offset: 0, has_more: false };
    if (query.offset === 2) return { items: [room(3, 'Third'), room(2, 'Second')], total: 3, limit: 20, offset: 2, has_more: false };
    const items = [room(1, 'First'), room(2, 'Second'), ...(extraRoom ? [room(0, 'Fresh')] : [])].slice(0, query.limit);
    return { items, total: 3, limit: query.limit, offset: 0, has_more: true };
  });
});

describe('My rooms page', () => {
  it('shows the active view first', async () => {
    mount();
    await screen.findByText('First');
    expect(lastQuery()).toEqual({ status: ['open', 'started'], order: 'asc', limit: 20, offset: 0 });
    expect(titles()).toEqual(['First', 'Second']);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 2 of 3 rooms');
    expect(screen.getByLabelText('Open')).toBeChecked();
    expect(screen.getByLabelText('Completed')).not.toBeChecked();
    expect(screen.getByLabelText('Sort')).toHaveValue('asc');
  });

  it('appends the next page without repeating a room and then hides the button', async () => {
    mount();
    await screen.findByText('First');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Third');
    expect(lastQuery()).toMatchObject({ offset: 2 });
    expect(titles()).toEqual(['First', 'Second', 'Third']);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('switches to the history view through the URL', async () => {
    mount();
    await screen.findByText('First');
    await userEvent.click(screen.getByRole('link', { name: 'History' }));
    await screen.findByText('Old game');
    expect(url()).toBe('/my-rooms?view=history');
    expect(lastQuery()).toEqual({ status: ['completed', 'cancelled'], order: 'desc', limit: 20, offset: 0 });
    expect(screen.getByLabelText('Completed')).toBeChecked();
    expect(screen.getByLabelText('Open')).not.toBeChecked();
    expect(screen.getByLabelText('Sort')).toHaveValue('desc');
  });

  it('applies filters to the URL and rejects an invalid date range', async () => {
    mount('/my-rooms?view=history');
    await screen.findByText('Old game');
    await userEvent.selectOptions(screen.getByLabelText('Activity'), '2');
    await userEvent.click(screen.getByLabelText('Cancelled'));
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(url()).toBe('/my-rooms?view=history&status=completed&sport_id=2');
    await userEvent.type(screen.getByLabelText('From'), '2026-10-20T10:00');
    await userEvent.type(screen.getByLabelText('Until'), '2026-10-10T10:00');
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/From date must be before/);
    expect(url()).toBe('/my-rooms?view=history&status=completed&sport_id=2');
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(url()).toBe('/my-rooms');
  });

  it('reloads on a personal room event, keeping the loaded rooms, and ignores lobby events', async () => {
    mount();
    await screen.findByText('First');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Third');
    const calls = listMine.mock.calls.length;
    for (const event of [{ type: 'room_created', room: { id: 9 } }, { type: 'room_updated', room: { id: 9 } }, { type: 'lobby.ready' }]) await send(event);
    expect(listMine).toHaveBeenCalledTimes(calls);
    extraRoom = true;
    await send({ type: 'room.updated', room_id: 5 });
    await screen.findByText('Fresh');
    expect(lastQuery()).toMatchObject({ limit: 20, offset: 0 });
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows a failed request with a retry button', async () => {
    listMine.mockRejectedValueOnce(new Error('Unable to reach the server. Please try again.'));
    mount();
    await screen.findByText('Unable to reach the server. Please try again.');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('First');
  });

  it('shows a message and sends no request for an invalid URL', async () => {
    mount('/my-rooms?status=archived');
    await screen.findByText(/valid status/i);
    expect(listMine).not.toHaveBeenCalled();
  });
});

describe('My rooms empty states', () => {
  beforeEach(() => {
    listMine.mockReset();
    listMine.mockResolvedValue({ items: [], total: 0, limit: 20, offset: 0, has_more: false });
  });

  const emptyState = async (start) => {
    mount(start);
    const heading = await screen.findByRole('heading', { level: 3 });
    const action = heading.parentElement.querySelector('a, button');
    return { title: heading.textContent, action: action?.textContent ?? null };
  };

  it('offers hosting on Active and All, nothing on History, and clearing when filtered', async () => {
    expect(await emptyState('/my-rooms')).toMatchObject({ title: "You aren't hosting any active rooms", action: 'Host a Room' });
  });

  it('has no action on History', async () => {
    expect(await emptyState('/my-rooms?view=history')).toEqual({ title: 'No room history yet', action: null });
  });

  it('offers hosting on All', async () => {
    expect(await emptyState('/my-rooms?view=all')).toMatchObject({ title: "You haven't hosted any rooms yet", action: 'Host a Room' });
  });

  it('offers clearing when a filter is set', async () => {
    mount('/my-rooms?sport_id=1');
    await screen.findByText('No rooms match these filters');
    const clear = screen.getAllByRole('button', { name: 'Clear filters' }).at(-1);
    await userEvent.click(clear);
    expect(url()).toBe('/my-rooms');
  });
});
