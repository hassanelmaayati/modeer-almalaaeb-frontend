import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoomPage from '../../src/pages/RoomPage';
import NotificationsPage from '../../src/pages/NotificationsPage';
import roomService from '../../src/services/roomService';
import roomMemberService from '../../src/services/roomMemberService';
import userService from '../../src/services/userService';
import notificationService from '../../src/services/notificationService';
import sportService from '../../src/services/sportService';
import { resetUserDirectory } from '../../src/lib/helpers/userDirectory';

const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));
vi.mock('../../src/services/roomService', () => ({ default: { get: vi.fn(), cancel: vi.fn(), transferHost: vi.fn() } }));
vi.mock('../../src/services/roomMemberService', () => ({ default: { list: vi.fn(), request: vi.fn(), update: vi.fn(), leave: vi.fn(), invite: vi.fn() } }));
vi.mock('../../src/services/userService', () => ({ default: { listByIds: vi.fn(), search: vi.fn() } }));
vi.mock('../../src/services/notificationService', () => ({ default: { list: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: vi.fn() } }));

const users = [{ id: 1, user_name: 'Host' }, { id: 2, user_name: 'Player' }, { id: 3, user_name: 'Teammate' }, { id: 4, user_name: 'Invitee' }];
const room = { id: 10, host_id: 1, sport_id: 1, title: 'Friday football', starts_at: '2030-10-10T15:00:00Z', ends_at: '2030-10-10T16:00:00Z', area: 'Manama', district: 'capital', capacity: 4, slots_left: 2, status: 'open', slot_layout: {}, venue_notes: 'Court 7' };
const notification = { id: 20, target: { type: 'room', id: 10 }, text: 'Your place was approved', read_at: null, created_at: '2026-10-04T12:00:00Z' };
const session = id => ({ user: users.find(user => user.id === id) || null, loading: false });

function renderRoom(id = 2) {
  return render(<MemoryRouter initialEntries={['/rooms/10']}><Routes><Route path="/rooms/:roomId" element={<RoomPage session={session(id)} />} /></Routes></MemoryRouter>);
}
function renderNotifications(id = 2) {
  return render(<MemoryRouter initialEntries={['/notifications']}><NotificationsPage session={session(id)} /></MemoryRouter>);
}
async function event(value) { await act(async () => { for (const callback of live.listeners) callback(value); }); }

beforeEach(() => {
  live.listeners.clear();
  roomService.get.mockReset().mockResolvedValue(room);
  sportService.list.mockReset().mockResolvedValue([{ id: 1, name: 'Football' }]);
  roomService.cancel.mockReset().mockResolvedValue({ ...room, status: 'cancelled' });
  roomMemberService.list.mockReset().mockResolvedValue([]);
  for (const method of ['request', 'update', 'leave', 'invite']) roomMemberService[method].mockReset().mockResolvedValue({});
  resetUserDirectory();
  userService.listByIds.mockReset().mockImplementation(async ids => users.filter(user => ids.includes(user.id)));
  userService.search.mockReset().mockImplementation(async text => users.filter(user => user.user_name.toLowerCase().includes(text.toLowerCase())));
  roomService.transferHost.mockReset().mockResolvedValue(room);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  notificationService.list.mockReset().mockResolvedValue({ items: [notification], unread_count: 1 });
  notificationService.markRead.mockReset().mockResolvedValue({ ...notification, read_at: '2026-10-04T13:00:00Z' });
  notificationService.markAllRead.mockReset().mockResolvedValue(null);
});

describe('room lobby access and admission', () => {
  it('shows public server availability while keeping the roster hidden from guests', async () => {
    roomService.get.mockResolvedValue({ ...room, venue_notes: undefined });
    renderRoom(null);
    expect(await screen.findByRole('heading', { name: 'Friday football' })).toBeInTheDocument();
    expect(screen.getByText('2 available places of 4; the host has a place.')).toBeInTheDocument();
    expect(screen.getByText('Manama · Capital')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to request a place' })).toHaveAttribute('href', '/sign-in');
    expect(screen.queryByRole('heading', { name: 'Players' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Court 7/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
  });

  it('refreshes eligibility before requesting and refuses a now-full room', async () => {
    const user = userEvent.setup();
    roomService.get.mockResolvedValueOnce(room).mockResolvedValue({ ...room, slots_left: 0 });
    renderRoom();
    await user.click(await screen.findByRole('button', { name: 'Request to join' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This activity is full.');
    expect(roomMemberService.request).not.toHaveBeenCalled();
  });

  it('requests a place through HTTP and lets a pending player withdraw without seeing the roster', async () => {
    const user = userEvent.setup();
    roomMemberService.request.mockImplementation(async () => {
      roomMemberService.list.mockResolvedValue([{ id: 2, user_id: 2, status: 'pending', requested: true }]);
    });
    renderRoom();
    await user.click(await screen.findByRole('button', { name: 'Request to join' }));
    const withdraw = await screen.findByRole('button', { name: 'Withdraw request' });
    expect(roomMemberService.request).toHaveBeenCalledWith('10');
    expect(screen.queryByRole('heading', { name: 'Players' })).not.toBeInTheDocument();
    await user.click(withdraw);
    expect(roomMemberService.leave).toHaveBeenCalledWith('10');
  });

  it('accepts a host invitation and never offers another request to a terminal member', async () => {
    const user = userEvent.setup();
    roomMemberService.list.mockResolvedValue([{ id: 2, user_id: 2, status: 'pending', requested: false }]);
    const view = renderRoom();
    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    expect(roomMemberService.update).toHaveBeenCalledWith('10', 2, { status: 'accepted' });
    view.unmount();
    roomMemberService.list.mockResolvedValue([{ id: 2, user_id: 2, status: 'removed' }]);
    renderRoom();
    expect(await screen.findByText('You were removed from this activity. Another request is unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
  });

  it('allows admitted players to select a free configured place, clear it and leave', async () => {
    const user = userEvent.setup();
    roomService.get.mockResolvedValue({ ...room, slot_layout: { slots: [{ id: 'A1', label: 'Goalkeeper' }, { id: 'A2', label: 'Forward' }] } });
    roomMemberService.list.mockResolvedValue([{ id: 2, user_id: 2, status: 'accepted', position: null }, { id: 3, user_id: 3, status: 'accepted', position: 'A1' }]);
    renderRoom();
    expect(await screen.findByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByText('Meeting details: Court 7')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Goalkeeper — taken' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Place', exact: true }), 'A2');
    await user.click(screen.getByRole('button', { name: 'Save place' }));
    expect(roomMemberService.update).toHaveBeenCalledWith('10', 2, { position: 'A2' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save place' })).toBeEnabled());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Place', exact: true }), '');
    await user.click(screen.getByRole('button', { name: 'Save place' }));
    expect(roomMemberService.update).toHaveBeenLastCalledWith('10', 2, { position: null });
    await user.click(await screen.findByRole('button', { name: 'Leave room' }));
    expect(roomMemberService.leave).toHaveBeenCalledWith('10');
  });

  it('gives the host approval, removal, invitation and reasoned cancellation controls', async () => {
    const user = userEvent.setup();
    roomMemberService.list.mockResolvedValue([{ id: 2, user_id: 2, status: 'pending', requested: true }]);
    renderRoom(1);
    await user.click(await screen.findByRole('button', { name: 'Approve Player' }));
    expect(roomMemberService.update).toHaveBeenCalledWith('10', 2, { status: 'accepted' });
    await user.click(await screen.findByRole('button', { name: 'Remove Player' }));
    expect(roomMemberService.update).toHaveBeenCalledWith('10', 2, { status: 'removed' });
    // Players are found by searching, not by choosing from everyone.
    await user.type(await screen.findByLabelText('Invite player'), 'Invit');
    await user.click(await screen.findByRole('button', { name: 'Invite Invitee' }));
    expect(roomMemberService.invite).toHaveBeenCalledWith('10', 4);
    await user.type(await screen.findByRole('textbox', { name: 'Cancellation reason' }), 'Bad weather');
    await user.click(screen.getByRole('button', { name: 'Cancel room' }));
    expect(roomService.cancel).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, cancel room' }));
    expect(roomService.cancel).toHaveBeenCalledWith('10', 'Bad weather');
  });

  it.each(['started', 'completed'])('records attendance for a player in a %s room', async status => {
    const user = userEvent.setup();
    roomService.get.mockResolvedValue({ ...room, status });
    roomMemberService.list.mockResolvedValue([{ id: 2, user_id: 2, status: 'accepted' }]);
    renderRoom(1);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Attendance for Player' }), 'present');
    await user.click(screen.getByRole('button', { name: 'Save Player record' }));
    expect(roomMemberService.update).toHaveBeenCalledWith('10', 2, { attendance: 'present' });
  });

  describe('host rating', () => {
    const completed = { ...room, status: 'completed' };
    const present = (extra = {}) => [{ id: 2, user_id: 2, status: 'accepted', attendance: 'present', ...extra }];
    const stars = (n) => screen.getByRole('radio', { name: `${n} ${n === 1 ? 'star' : 'stars'}` });

    it('rates a present player of a completed room once the host confirms that ratings are final', async () => {
      const user = userEvent.setup();
      roomService.get.mockResolvedValue(completed);
      roomMemberService.list.mockResolvedValue(present());
      renderRoom(1);
      await user.click(await screen.findByRole('radio', { name: '5 stars' }));
      await user.click(screen.getByRole('button', { name: 'Submit rating for Player' }));
      expect(window.confirm).toHaveBeenCalledWith('Ratings are final. Give Player 5 stars?');
      await waitFor(() => expect(roomMemberService.update).toHaveBeenCalledWith('10', 2, { rating: 5 }));
    });

    it('locks a rating that was already saved', async () => {
      roomService.get.mockResolvedValue(completed);
      roomMemberService.list.mockResolvedValue(present({ rating: 4 }));
      renderRoom(1);
      expect(await screen.findByText('You rated Player 4 out of 5. Ratings are final.')).toBeVisible();
      expect(stars(4)).toBeChecked();
      expect(stars(2)).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Submit rating for Player' })).not.toBeInTheDocument();
    });

    it('shows the backend detail when the player was already rated (409)', async () => {
      const user = userEvent.setup();
      roomService.get.mockResolvedValue(completed);
      roomMemberService.list.mockResolvedValue(present());
      roomMemberService.update.mockRejectedValue({ status: 409, message: 'This player was already rated' });
      renderRoom(1);
      await user.click(await screen.findByRole('radio', { name: '3 stars' }));
      await user.click(screen.getByRole('button', { name: 'Submit rating for Player' }));
      expect(await screen.findByText('This player was already rated')).toBeVisible();
    });

    it.each([
      ['a started room', { ...room, status: 'started' }, present()],
      ['a player who was not present', completed, present({ attendance: 'no_show' })],
      ['a player with unknown attendance', completed, present({ attendance: 'unknown' })],
    ])('does not offer a rating for %s', async (_name, roomData, members) => {
      roomService.get.mockResolvedValue(roomData);
      roomMemberService.list.mockResolvedValue(members);
      renderRoom(1);
      await screen.findByRole('heading', { name: 'Players' });
      expect(screen.queryByRole('group', { name: 'Rating for Player' })).not.toBeInTheDocument();
    });
  });

  describe('transferring the host role', () => {
    const roster = [{ id: 2, user_id: 2, status: 'accepted' }, { id: 3, user_id: 3, status: 'accepted', attendance: 'no_show' }, { id: 4, user_id: 4, status: 'pending', requested: true }];

    it('lets the host hand the room to an accepted player who did not no-show, after confirming', async () => {
      const user = userEvent.setup();
      roomMemberService.list.mockResolvedValue(roster);
      renderRoom(1);
      const choice = await screen.findByRole('combobox', { name: 'New host' });
      expect([...choice.options].map(option => option.textContent)).toEqual(['Choose a player', 'Player']);
      await user.selectOptions(choice, '2');
      await user.click(screen.getByRole('button', { name: 'Transfer host' }));
      expect(window.confirm).toHaveBeenCalledWith('Make Player the host? You will no longer be able to manage this room.');
      await waitFor(() => expect(roomService.transferHost).toHaveBeenCalledWith('10', 2));
    });

    it('does nothing when the host declines the confirmation', async () => {
      window.confirm.mockReturnValue(false);
      const user = userEvent.setup();
      roomMemberService.list.mockResolvedValue(roster);
      renderRoom(1);
      await user.selectOptions(await screen.findByRole('combobox', { name: 'New host' }), '2');
      await user.click(screen.getByRole('button', { name: 'Transfer host' }));
      expect(roomService.transferHost).not.toHaveBeenCalled();
    });

    it('is offered only to the host of an open or started room', async () => {
      roomMemberService.list.mockResolvedValue(roster);
      const first = renderRoom(2);
      await screen.findByRole('heading', { name: 'Friday football' });
      expect(screen.queryByRole('heading', { name: 'Transfer host' })).not.toBeInTheDocument();
      first.unmount();
      roomService.get.mockResolvedValue({ ...room, status: 'completed' });
      renderRoom(1);
      await screen.findByRole('heading', { name: 'Players' });
      expect(screen.queryByRole('heading', { name: 'Transfer host' })).not.toBeInTheDocument();
    });

    it('announces who is the host now when a room.host_changed event reloads the room', async () => {
      renderRoom(3);
      await screen.findByRole('heading', { name: 'Friday football' });
      roomService.get.mockResolvedValue({ ...room, host_id: 2 });
      await event({ type: 'room.host_changed', room_id: 10 });
      expect(await screen.findByText('Player is now the host.')).toBeVisible();
    });
  });

  describe('joining', () => {
    it('joins an open room straight away and says so', async () => {
      const user = userEvent.setup();
      roomService.get.mockResolvedValue({ ...room, admission_policy: 'open' });
      roomMemberService.request.mockResolvedValue({ id: 5, user_id: 2, status: 'accepted' });
      renderRoom(2);
      await user.click(await screen.findByRole('button', { name: 'Join room' }));
      expect(await screen.findByText('You joined this room.')).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument();
    });

    it('still asks the host for approval in other rooms', async () => {
      const user = userEvent.setup();
      roomMemberService.request.mockResolvedValue({ id: 5, user_id: 2, status: 'pending' });
      renderRoom(2);
      await user.click(await screen.findByRole('button', { name: 'Request to join' }));
      expect(await screen.findByText('Request sent. Waiting for host approval.')).toBeVisible();
    });
  });

  it('explains a missing room clearly', async () => {
    roomService.get.mockRejectedValue({ status: 404, message: 'Room not found' });
    renderRoom(2);
    expect(await screen.findByRole('alert')).toHaveTextContent('Room not found. It may have been removed, or it is private.');
  });

  it.each(['open', 'cancelled', 'finished', 'unknown'])('does not offer attendance or rating controls for a %s room', async status => {
    roomService.get.mockResolvedValue({ ...room, status });
    roomMemberService.list.mockResolvedValue([{ id: 2, user_id: 2, status: 'accepted' }]);
    renderRoom(1);
    await screen.findByRole('heading', { name: 'Players' });
    expect(screen.queryByRole('combobox', { name: 'Attendance for Player' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Rating for Player' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Player record' })).not.toBeInTheDocument();
    expect(roomMemberService.update).not.toHaveBeenCalled();
  });

  it('refreshes authorized details on reconnect and matching events, and removes listeners on unmount', async () => {
    const view = renderRoom();
    await screen.findByRole('heading', { name: 'Friday football' });
    await event({ type: 'room.updated', room_id: 99 });
    expect(roomService.get).toHaveBeenCalledTimes(1);
    await event({ type: 'room.updated', room_id: 10 });
    await waitFor(() => expect(roomService.get).toHaveBeenCalledTimes(2));
    await event({ type: 'connection.ready' });
    await waitFor(() => expect(roomService.get).toHaveBeenCalledTimes(3));
    view.unmount();
    expect(live.listeners.size).toBe(0);
  });

  it('presents request failures without exposing host controls and permits loading retry', async () => {
    const user = userEvent.setup();
    roomService.get.mockRejectedValueOnce(new Error('Room not found'));
    renderRoom();
    expect(await screen.findByRole('alert')).toHaveTextContent('Room not found');
    expect(screen.queryByRole('heading', { name: 'Host controls' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Friday football' })).toBeInTheDocument();
  });
});

describe('saved notifications', () => {
  it('requires sign-in and does not request private notifications for guests', () => {
    renderNotifications(null);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(notificationService.list).not.toHaveBeenCalled();
  });

  it('opens only existing room/group views while direct and cup alerts remain readable', async () => {
    notificationService.list.mockResolvedValue({ unread_count: 4, items: [notification, { ...notification, id: 21, target: { type: 'group', id: 3 } }, { ...notification, id: 22, target: { type: 'direct', id: 4 } }, { ...notification, id: 23, target: { type: 'cup', id: 5 } }] });
    renderNotifications();
    await screen.findAllByText(notification.text);
    expect(screen.getAllByRole('link', { name: 'Open details' }).map(link => link.getAttribute('href'))).toEqual(['/rooms/10', '/groups?group_id=3']);
    expect(screen.getAllByRole('button', { name: 'Mark read', exact: true })).toHaveLength(4);
  });

  it('persists individual and all-read actions, then refetches unread state', async () => {
    const user = userEvent.setup();
    renderNotifications();
    await user.click(await screen.findByRole('button', { name: 'Mark read', exact: true }));
    expect(notificationService.markRead).toHaveBeenCalledWith(20);
    await waitFor(() => expect(notificationService.list).toHaveBeenCalledTimes(2));
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }));
    expect(notificationService.markAllRead).toHaveBeenCalled();
    await waitFor(() => expect(notificationService.list).toHaveBeenCalledTimes(3));
  });

  it('recovers saved alerts on realtime reconnect and displays empty/error states', async () => {
    notificationService.list.mockResolvedValueOnce({ items: [], unread_count: 0 }).mockRejectedValueOnce(new Error('Notifications unavailable')).mockResolvedValue({ items: [notification], unread_count: 1 });
    const user = userEvent.setup();
    renderNotifications();
    expect(await screen.findByRole('heading', { name: 'No notifications yet' })).toBeInTheDocument();
    await event({ type: 'connection.ready' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Notifications unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(notification.text)).toBeInTheDocument();
  });
});
