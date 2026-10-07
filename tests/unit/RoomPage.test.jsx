import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const start = new Date(Date.now() + 3 * 24 * 3600e3).toISOString();
const end = new Date(Date.now() + 3 * 24 * 3600e3 + 3600e3).toISOString();
const publicRoom = {
  id: 1,
  host_id: 7,
  sport_id: 2,
  group_id: null,
  title: 'Sunrise run',
  description: 'Easy morning run',
  notes: 'Bring water',
  difficulty: 'beginners',
  starts_at: start,
  ends_at: end,
  capacity: 8,
  slots_left: 5,
  status: 'open',
  visibility: 'public',
  admission_policy: 'approval',
  district: 'northern',
  area: 'Budaiya',
  distance_km: 5,
  pace_notes: 'Easy pace',
  route_notes: 'Along the coast road',
  revision: 2,
};
const hostRoom = { ...publicRoom, venue_notes: 'Meet at gate 2', venue_location: { latitude: 26.2, longitude: 50.5 } };

let room;
let members = [];
const cancel = vi.fn();
vi.mock('../../src/services/roomService', () => ({ default: { get: async () => room, cancel: (...args) => cancel(...args) } }));
vi.mock('../../src/services/roomMemberService', () => ({ default: { list: async () => members, request: async () => ({}), update: async () => ({}), invite: async () => ({}), leave: async () => null } }));
vi.mock('../../src/services/userService', () => ({ default: { listByIds: async (ids) => [{ id: 7, user_name: 'Fatema' }].filter((user) => ids.includes(user.id)) } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: async () => [{ id: 1, name: 'Football' }, { id: 2, name: 'Running' }] } }));
vi.mock('../../src/services/websocketService', () => ({ listen: () => () => {} }));
vi.mock('../../src/components/activities/LocationView', () => ({ default: () => <div data-testid="location-view" /> }));
const { default: RoomPage } = await import('../../src/pages/RoomPage');

const mount = (user) => render(
  <MemoryRouter initialEntries={['/rooms/1']}>
    <Routes>
      <Route path="/rooms/:roomId" element={<RoomPage session={{ user, loading: false }} />} />
    </Routes>
  </MemoryRouter>,
);

const details = () => {
  const section = screen.getByRole('heading', { name: 'Details' }).parentElement;
  return Object.fromEntries([...section.querySelectorAll('dl > div')].map((row) => [row.querySelector('dt').textContent, row.querySelector('dd').textContent]));
};

beforeEach(() => {
  room = publicRoom;
  members = [];
  cancel.mockReset();
  cancel.mockImplementation(async () => {
    room = { ...publicRoom, status: 'cancelled', cancellation_reason: 'Venue closed', cancelled_at: new Date().toISOString() };
    return room;
  });
});

describe('Room page', () => {
  it('shows every public detail of the room to a visitor', async () => {
    mount(null);
    await screen.findByRole('heading', { name: 'Sunrise run' });
    await screen.findByText('Fatema', { selector: 'dd' });
    expect(details()).toEqual({
      Activity: 'Running',
      Status: 'Open',
      Difficulty: 'Beginners',
      Governorate: 'Northern',
      Area: 'Budaiya',
      Visibility: 'Public',
      Joining: 'The host approves each request',
      Host: 'Fatema',
      Capacity: '8 places',
      Distance: '5 km',
      Pace: 'Easy pace',
      Route: 'Along the coast road',
    });
    expect(screen.getByText('Easy morning run')).toBeInTheDocument();
    expect(screen.getByText('Notes: Bring water')).toBeInTheDocument();
    expect(screen.getByText(/Budaiya · Northern/)).toBeInTheDocument();
  });

  it('keeps the private venue details from a visitor', async () => {
    mount(null);
    await screen.findByRole('heading', { name: 'Sunrise run' });
    expect(screen.queryByText(/Meeting details/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('location-view')).not.toBeInTheDocument();
  });

  it('shows the venue notes and map to the host as well', async () => {
    room = hostRoom;
    mount({ id: 7 });
    await screen.findByRole('heading', { name: 'Sunrise run' });
    expect(screen.getByText('Meeting details: Meet at gate 2')).toBeInTheDocument();
    expect(screen.getByTestId('location-view')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit room' })).toHaveAttribute('href', '/rooms/1/edit');
  });

  it('leaves out distance, pace and route for rooms without them and hides Edit from other users', async () => {
    room = { ...publicRoom, distance_km: null, pace_notes: null, route_notes: null };
    mount({ id: 8 });
    await screen.findByRole('heading', { name: 'Sunrise run' });
    expect(Object.keys(details())).not.toEqual(expect.arrayContaining(['Distance']));
    expect(Object.keys(details())).not.toContain('Pace');
    expect(Object.keys(details())).not.toContain('Route');
    expect(screen.queryByRole('link', { name: 'Edit room' })).not.toBeInTheDocument();
  });
});

describe('Room page cancellation', () => {
  it('asks the host for a reason, then for confirmation, before cancelling', async () => {
    mount({ id: 7 });
    await screen.findByRole('heading', { name: 'Sunrise run' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Write a reason/);
    await userEvent.type(screen.getByLabelText('Cancellation reason'), '  Venue closed  ');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    expect(cancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel room' }));
    await screen.findByText('Room cancelled.');
    expect(cancel).toHaveBeenCalledWith('1', 'Venue closed');
  });

  it('shows who cancelled, when and why once the room is cancelled', async () => {
    mount({ id: 7 });
    await screen.findByRole('heading', { name: 'Sunrise run' });
    expect(screen.queryByRole('region', { name: 'Cancellation' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Cancellation reason'), 'Venue closed');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel room' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, cancel room' }));
    const record = await screen.findByRole('region', { name: 'Cancellation' });
    expect(record).toHaveTextContent(/The host cancelled this room on .+ at \d\d:\d\d \(Bahrain time\)\./);
    expect(record).toHaveTextContent('Reason: Venue closed');
    expect(screen.queryByRole('button', { name: 'Cancel room' })).not.toBeInTheDocument();
  });

  it('shows the reason to a visitor too', async () => {
    room = { ...publicRoom, status: 'cancelled', cancellation_reason: 'Rain', cancelled_at: '2026-10-06T10:30:00+03:00' };
    mount(null);
    const record = await screen.findByRole('region', { name: 'Cancellation' });
    expect(record).toHaveTextContent('The host cancelled this room on Tue 6 Oct at 10:30 (Bahrain time).');
    expect(record).toHaveTextContent('Reason: Rain');
  });

  it('copes with a room cancelled before the reason was recorded', async () => {
    room = { ...publicRoom, status: 'cancelled', cancellation_reason: null, cancelled_at: null };
    mount(null);
    const record = await screen.findByRole('region', { name: 'Cancellation' });
    expect(record).toHaveTextContent('The host cancelled this room.');
    expect(record).not.toHaveTextContent('Reason:');
  });
});

describe('Room chat entry point', () => {
  const chatLink = (name) => screen.queryByRole('link', { name });

  it('is hidden from visitors and from people without a place', async () => {
    mount(null);
    await screen.findByRole('heading', { name: 'Sunrise run' });
    expect(chatLink('Open room chat')).not.toBeInTheDocument();
  });

  it('is hidden while a request is pending', async () => {
    members = [{ id: 1, room_id: 1, user_id: 3, status: 'pending', requested: true }];
    mount({ id: 3 });
    await screen.findByRole('heading', { name: 'Sunrise run' });
    expect(chatLink('Open room chat')).not.toBeInTheDocument();
  });

  it('opens the room chat for the host', async () => {
    room = hostRoom;
    mount({ id: 7 });
    expect(await screen.findByRole('link', { name: 'Open room chat' })).toHaveAttribute('href', '/messages/room/1');
  });

  it('opens the room chat for an accepted player', async () => {
    members = [{ id: 1, room_id: 1, user_id: 3, status: 'accepted', requested: true }];
    mount({ id: 3 });
    expect(await screen.findByRole('link', { name: 'Open room chat' })).toHaveAttribute('href', '/messages/room/1');
  });

  it('is offered as a read-only view once the room is cancelled', async () => {
    room = { ...hostRoom, status: 'cancelled', cancellation_reason: 'Rain' };
    mount({ id: 7 });
    expect(await screen.findByRole('link', { name: 'View room chat' })).toHaveAttribute('href', '/messages/room/1');
  });
});
