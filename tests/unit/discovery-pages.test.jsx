import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '../../src/pages/HomePage';
import SportsPage from '../../src/pages/SportsPage';
import sportService from '../../src/services/sportService';
import roomService from '../../src/services/roomService';

vi.mock('../../src/services/sportService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/roomService', () => ({ default: { list: vi.fn(), get: vi.fn() } }));
const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));

const sports = [{ id: 1, name: 'Soccer' }, { id: 2, name: 'Basketball' }];
const rooms = [
  { id: 11, title: 'Friday football', sport_id: 1 },
  { id: 12, title: 'Evening basketball', sport_id: 2 },
  { id: 13, title: 'Weekend football', sport_id: 1 },
].map((room) => ({
  ...room, host_id: 1, starts_at: '2030-10-10T15:00:00Z', ends_at: '2030-10-10T16:00:00Z',
  area: 'Manama', district: 'capital', difficulty: 'beginners', capacity: 10, status: 'open',
}));

function RouteProbe() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname + location.search}</output>;
}

function renderPage(Page, url = '/', session = { user: null, loading: false }) {
  return render(<MemoryRouter initialEntries={[url]}><Page session={session} /><RouteProbe /></MemoryRouter>);
}

beforeEach(() => {
  live.listeners.clear();
  sportService.list.mockReset().mockResolvedValue(sports);
  roomService.list.mockReset().mockResolvedValue(rooms);
});

describe('Home activity discovery', () => {
  it('uses the live catalogue and shows only the first two upcoming rooms', async () => {
    renderPage(HomePage);
    expect(screen.getByRole('heading', { name: 'Find your people. Get moving.' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Soccer' })).toHaveAttribute('href', '/sports?sport_id=1');
    expect(screen.getByRole('link', { name: 'Find an activity' })).toHaveAttribute('href', '/sports');
    await screen.findByRole('heading', { name: 'Friday football' });
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole('button', { name: 'View activity' })).toBeInTheDocument();
    expect(within(cards[0]).getByText('Manama · Capital')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evening basketball' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Weekend football' })).not.toBeInTheDocument();
    expect(roomService.list).toHaveBeenCalledWith({}, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('announces loading and then presents useful empty states', async () => {
    let resolveSports;
    let resolveRooms;
    sportService.list.mockImplementation(() => new Promise((resolve) => { resolveSports = resolve; }));
    roomService.list.mockImplementation(() => new Promise((resolve) => { resolveRooms = resolve; }));
    renderPage(HomePage);
    expect(screen.getAllByText('Loading…')).toHaveLength(2);
    await waitFor(() => expect(sportService.list).toHaveBeenCalledTimes(1));
    await act(async () => { resolveSports([]); resolveRooms([]); });
    expect(await screen.findByRole('heading', { name: 'No activities available' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No upcoming activities' })).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('keeps the available catalogue usable when room discovery fails and can retry', async () => {
    const user = userEvent.setup();
    roomService.list.mockRejectedValueOnce(new Error('Activities are unavailable.'));
    renderPage(HomePage);
    expect(await screen.findByRole('alert')).toHaveTextContent('Activities are unavailable.');
    expect(screen.getByRole('link', { name: 'Soccer' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Friday football' })).toBeInTheDocument();
    expect(roomService.list).toHaveBeenCalledTimes(2);
    expect(sportService.list).toHaveBeenCalledTimes(1);
  });

  it('refetches discovery after a lobby reconnect and removes cancelled rooms from the page', async () => {
    renderPage(HomePage);
    await screen.findByRole('heading', { name: 'Friday football' });
    roomService.list.mockResolvedValue([]);
    await act(async () => { for (const callback of live.listeners) callback({ type: 'lobby.ready' }); });
    expect(await screen.findByRole('heading', { name: 'No upcoming activities' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Friday football' })).not.toBeInTheDocument();
  });
});

describe('Sports filters and discovery', () => {
  it('restores shareable backend filters from the URL in Bahrain time', async () => {
    renderPage(SportsPage, '/sports?sport_id=2&difficulty=advanced&district=southern&starts_from=2030-10-10T15%3A00%3A00Z&starts_to=2030-10-11T15%3A00%3A00Z');
    await screen.findByRole('link', { name: /Soccer/ });
    await waitFor(() => expect(screen.getByLabelText('Activity')).toHaveValue('2'));
    expect(screen.getByLabelText('Difficulty')).toHaveValue('advanced');
    expect(screen.getByLabelText('Governorate')).toHaveValue('southern');
    expect(screen.getByLabelText('From')).toHaveValue('2030-10-10T18:00');
    expect(screen.getByLabelText('Until')).toHaveValue('2030-10-11T18:00');
    expect(roomService.list).toHaveBeenCalledWith({
      sport_id: '2', difficulty: 'advanced', district: 'southern',
      starts_from: '2030-10-10T15:00:00Z', starts_to: '2030-10-11T15:00:00Z',
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('applies all five filters with UTC timestamps and clears the URL and controls', async () => {
    const user = userEvent.setup();
    renderPage(SportsPage, '/sports');
    await screen.findByRole('link', { name: /Soccer/ });
    await user.selectOptions(screen.getByLabelText('Activity'), '2');
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'medium');
    await user.selectOptions(screen.getByLabelText('Governorate'), 'muharraq');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2030-10-10T18:00' } });
    fireEvent.change(screen.getByLabelText('Until'), { target: { value: '2030-10-11T19:00' } });
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(roomService.list).toHaveBeenLastCalledWith({
      sport_id: '2', difficulty: 'medium', district: 'muharraq',
      starts_from: '2030-10-10T15:00:00.000Z', starts_to: '2030-10-11T16:00:00.000Z',
    }, expect.any(Object)));
    const route = new URL(screen.getByLabelText('Current route').textContent, 'http://localhost');
    expect(route.searchParams.get('district')).toBe('muharraq');
    expect(route.searchParams.get('starts_from')).toBe('2030-10-10T15:00:00.000Z');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(roomService.list).toHaveBeenLastCalledWith({}, expect.any(Object)));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/sports');
    expect(screen.getByLabelText('Activity')).toHaveValue('');
    expect(screen.getByLabelText('From')).toHaveValue('');
  });

  it('prevents reversed date ranges from sending a new discovery request', async () => {
    const user = userEvent.setup();
    renderPage(SportsPage, '/sports');
    await screen.findByRole('heading', { name: 'Friday football' });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2030-10-11T18:00' } });
    fireEvent.change(screen.getByLabelText('Until'), { target: { value: '2030-10-10T18:00' } });
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The From date must be before or equal to the Until date.');
    expect(roomService.list).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Current route').textContent).toBe('/sports');
  });

  it('reports malformed URL filters without calling the backend', async () => {
    renderPage(SportsPage, '/sports?district=unknown');
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a valid governorate.');
    expect(roomService.list).not.toHaveBeenCalled();
  });

  it('provides empty results and preserves filters when no rooms match', async () => {
    roomService.list.mockResolvedValue([]);
    renderPage(SportsPage, '/sports?difficulty=advanced');
    expect(await screen.findByRole('heading', { name: 'No upcoming activities' })).toBeInTheDocument();
    expect(screen.getByLabelText('Difficulty')).toHaveValue('advanced');
    expect(screen.getByText('Try another activity, district or date.')).toBeInTheDocument();
  });

  it('preserves active filters while refreshing on an activity update', async () => {
    renderPage(SportsPage, '/sports?district=capital');
    await screen.findByRole('heading', { name: 'Friday football' });
    await act(async () => { for (const callback of live.listeners) callback({ type: 'room_updated', room: { id: 11 } }); });
    await waitFor(() => expect(roomService.list).toHaveBeenCalledTimes(2));
    expect(roomService.list).toHaveBeenLastCalledWith({ district: 'capital' }, expect.any(Object));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/sports?district=capital');
  });
});
