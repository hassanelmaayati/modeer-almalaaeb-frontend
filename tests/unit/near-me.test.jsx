import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SportsPage from '../../src/pages/SportsPage';
import HomeGameCard from '../../src/components/home/HomeGameCard';
import sportService from '../../src/services/sportService';
import roomService from '../../src/services/roomService';

vi.mock('../../src/services/sportService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/roomService', () => ({ default: { listPage: vi.fn(), list: vi.fn(), get: vi.fn() } }));
const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));

const room = (id, extra = {}) => ({ id, host_id: 1, sport_id: 1, title: `Game ${id}`, starts_at: '2030-10-10T15:00:00Z', ends_at: '2030-10-10T16:00:00Z', area: 'Manama', district: 'capital', difficulty: 'beginners', capacity: 10, status: 'open', admission_policy: 'approval', slots_left: 3, km_away: null, ...extra });
const page = (start, count, extra) => Array.from({ length: count }, (_, index) => room(start + index, extra));

function Route() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname + location.search}</output>;
}
const mount = (url = '/sports') => render(<MemoryRouter initialEntries={[url]}><SportsPage session={{ user: null, loading: false }} /><Route /></MemoryRouter>);
const geolocation = { getCurrentPosition: vi.fn() };
const lastQuery = () => roomService.listPage.mock.calls.at(-1)[0];
const allow = (latitude = 26.23456, longitude = 50.56789) => geolocation.getCurrentPosition.mockImplementation(success => success({ coords: { latitude, longitude } }));

beforeEach(() => {
  live.listeners.clear();
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true });
  geolocation.getCurrentPosition.mockReset();
  sportService.list.mockReset().mockResolvedValue([{ id: 1, name: 'Football' }]);
  roomService.listPage.mockReset().mockResolvedValue({ items: page(1, 3), total: 3 });
});
afterEach(() => { delete navigator.geolocation; });

describe('"Near me" filter', () => {
  it('is hidden when the browser has no geolocation', async () => {
    delete navigator.geolocation;
    mount();
    await screen.findByRole('heading', { name: 'Game 1' });
    expect(screen.queryByRole('button', { name: 'Near me' })).not.toBeInTheDocument();
  });

  it('never asks for the location on its own', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Game 1' });
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(lastQuery()).not.toHaveProperty('near_lat');
    expect(screen.getByText(/location is not stored/)).toBeVisible();
  });

  it('sends a rounded position and the radius once the visitor presses Near me, without putting it in the URL', async () => {
    allow();
    const user = userEvent.setup();
    mount();
    await screen.findByRole('heading', { name: 'Game 1' });
    await user.click(screen.getByRole('button', { name: 'Near me' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ near_lat: 26.23, near_lng: 50.57, radius_km: 10, limit: 20, offset: 0 }));
    // Only what is needed: two decimals (about 1 km), never shown, never in the address bar.
    expect(document.body).not.toHaveTextContent('26.23');
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/sports');
    expect(screen.getByLabelText('Current route').textContent).not.toMatch(/near|26\.2/);
    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), expect.objectContaining({ timeout: 10_000 }));
  });

  it('changes the radius and can be switched off again', async () => {
    allow();
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Near me' }));
    await user.selectOptions(await screen.findByLabelText('Show activities within'), '20');
    await waitFor(() => expect(lastQuery()).toMatchObject({ radius_km: 20, near_lat: 26.23 }));
    await user.click(screen.getByRole('button', { name: 'Stop using my location' }));
    await waitFor(() => expect(lastQuery()).not.toHaveProperty('near_lat'));
    expect(lastQuery()).not.toHaveProperty('radius_km');
    expect(screen.getByRole('button', { name: 'Near me' })).toBeVisible();
  });

  it.each([[1, 'Location permission was denied. You can keep browsing without it.'], [2, 'Your location is not available right now.'], [3, 'Finding your location took too long. Please try again.']])('explains geolocation error %s and keeps browsing', async (code, message) => {
    geolocation.getCurrentPosition.mockImplementation((_success, failure) => failure({ code }));
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Near me' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(lastQuery()).not.toHaveProperty('near_lat');
    expect(screen.getByRole('button', { name: 'Near me' })).toBeEnabled();
  });
});

describe('distance on a game card', () => {
  const card = km => render(<HomeGameCard room={room(1, { km_away: km })} sportName="Football" onPreview={() => {}} />);
  it.each([[3, 'about 3 km away'], [12, 'about 12 km away'], [0, 'less than 1 km away']])('shows %s km as "%s"', (km, text) => {
    card(km);
    expect(screen.getByText(text)).toBeVisible();
  });
  it('shows nothing when no position was sent', () => {
    card(null);
    expect(screen.queryByText(/km away/)).not.toBeInTheDocument();
  });
});

describe('browsing with Load more', () => {
  it('asks for 20 at a time and shows the total from X-Total-Count', async () => {
    roomService.listPage.mockResolvedValue({ items: page(1, 20), total: 45 });
    mount();
    expect(await screen.findByText('45 activities found')).toBeVisible();
    expect(lastQuery()).toMatchObject({ limit: 20, offset: 0 });
    expect(screen.getByRole('button', { name: 'Load more activities' })).toBeVisible();
  });

  it('appends the next page at the right offset and stops when everything is shown', async () => {
    roomService.listPage.mockResolvedValueOnce({ items: page(1, 20), total: 25 }).mockResolvedValueOnce({ items: page(21, 5), total: 25 });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Load more activities' }));
    expect(await screen.findByRole('heading', { name: 'Game 25' })).toBeVisible();
    expect(roomService.listPage.mock.calls.map(([query]) => query.offset)).toEqual([0, 20]);
    expect(screen.getByRole('heading', { name: 'Game 1' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Load more activities' })).not.toBeInTheDocument();
  });

  it('does not repeat a room that moved between pages, and shows a failed page without losing the list', async () => {
    roomService.listPage.mockResolvedValueOnce({ items: page(1, 20), total: 40 }).mockRejectedValueOnce(new Error('Could not load more')).mockResolvedValueOnce({ items: [room(20), ...page(21, 2)], total: 40 });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Load more activities' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load more');
    expect(screen.getByRole('heading', { name: 'Game 1' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Load more activities' }));
    await screen.findByRole('heading', { name: 'Game 22' });
    expect(screen.getAllByRole('heading', { name: 'Game 20' })).toHaveLength(1);
  });

  it('reloads as many rooms as are on screen after a live update, so loaded pages are not undone', async () => {
    roomService.listPage.mockResolvedValueOnce({ items: page(1, 20), total: 30 }).mockResolvedValueOnce({ items: page(21, 10), total: 30 });
    const user = userEvent.setup();
    mount();
    await user.click(await screen.findByRole('button', { name: 'Load more activities' }));
    await screen.findByRole('heading', { name: 'Game 30' });
    roomService.listPage.mockResolvedValue({ items: page(1, 30), total: 30 });
    for (const callback of live.listeners) callback({ type: 'room_created', room: { id: 99 } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ limit: 30, offset: 0 }));
    expect(screen.getByRole('heading', { name: 'Game 30' })).toBeVisible();
  });

  it('puts the signed-in visitor\'s home governorate in the query and keeps it with Near me', async () => {
    allow();
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/sports']}><SportsPage session={{ user: { id: 1, district: 'muharraq' }, loading: false }} /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Game 1' });
    expect(lastQuery()).toMatchObject({ district: 'muharraq' });
    await user.click(screen.getByRole('button', { name: 'Near me' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ district: 'muharraq', near_lat: 26.23 }));
  });
});
