import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FriendsPage from '../../src/pages/FriendsPage';
import friendService from '../../src/services/friendService';
import userService from '../../src/services/userService';
import { addFriendCandidates, addFriendError, describeFriendship, friendUpdateFor, groupFriendships, isBlockedFlag, searchPeople } from '../../src/lib/helpers/friends';

const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));
vi.mock('../../src/services/friendService', () => ({ default: { list: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock('../../src/services/userService', () => ({ default: { list: vi.fn() } }));
const users = [1, 2, 3, 4, 5, 6, 7].map((id, index) => ({ id, user_name: ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Finn', 'Grace'][index] }));
const rows = [
  { id: 10, user_id: 1, other_user_id: 2, status: 'accepted' },
  { id: 11, user_id: 3, other_user_id: 1, status: 'pending' },
  { id: 12, user_id: 1, other_user_id: 4, status: 'pending' },
  { id: 13, user_id: 1, other_user_id: 5, status: 'accepted', user_blocked_other: 'true' },
  { id: 14, user_id: 1, other_user_id: 6, status: 'left' },
];
beforeEach(() => {
  live.listeners.clear();
  friendService.list.mockReset().mockResolvedValue(rows);
  friendService.update.mockReset().mockImplementation(async (otherId, changes) => ({ ...rows.find(row => describeFriendship(row, 1).otherUserId === otherId), ...changes }));
  friendService.create.mockReset().mockImplementation(async body => ({ id: 15, user_id: 1, ...body, status: 'pending' }));
  userService.list.mockReset().mockResolvedValue(users);
});
function show(tab = 'friends') { return render(<MemoryRouter initialEntries={['/friends?tab=' + tab]}><FriendsPage session={{ user: users[0] }} /></MemoryRouter>); }

describe('friendship direction, terminal states and candidate rules', () => {
  it.each([null, undefined, '', 'false', false, 0, '  NO ', 'none'])('treats %s as an unblocked API flag', value => expect(isBlockedFlag(value)).toBe(false));
  it.each([true, 'true', '1'])('treats %s as a blocked API flag', value => expect(isBlockedFlag(value)).toBe(true));
  it('distinguishes sent and received requests and maps the current user blocking field', () => {
    const sent = describeFriendship(rows[2], 1), received = describeFriendship(rows[1], 1);
    expect(sent).toMatchObject({ role: 'sent', requester: true, otherUserId: 4 });
    expect(received).toMatchObject({ role: 'received', requester: false, otherUserId: 3 });
    expect(friendUpdateFor('block', sent)).toEqual({ user_blocked_other: 'true' });
    expect(friendUpdateFor('block', received)).toEqual({ other_blocked_user: 'true' });
    expect(friendUpdateFor('unblock', received)).toEqual({ other_blocked_user: 'false' });
  });
  it('groups blocked accepted friends separately and excludes terminal records from new requests', () => {
    const grouped = groupFriendships(rows, 1);
    expect(Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, value.map(item => item.otherUserId)]))).toEqual({ friends: [2], received: [3], sent: [4], blocked: [5] });
    expect(addFriendCandidates(users, rows, 1).map(user => user.id)).toEqual([7]);
  });
  it('limits case-insensitive name searches and provides no results for an empty query', () => {
    const candidates = Array.from({ length: 10 }, (_, id) => ({ id, user_name: 'Player ' + id }));
    expect(searchPeople(candidates, ' PLAYER ')).toHaveLength(8);
    expect(searchPeople(candidates, 'player 9').map(user => user.id)).toEqual([9]);
    expect(searchPeople(candidates, ' ')).toEqual([]);
  });
  it.each([['accept', 'accepted'], ['decline', 'declined'], ['unfriend', 'left'], ['cancel', 'left']])('maps %s to the server transition %s', (kind, status) => {
    expect(friendUpdateFor(kind, describeFriendship(rows[0], 1))).toEqual({ status });
  });
  it('explains terminal friendship conflicts without exposing a second request action', () => {
    expect(addFriendError({ status: 409 })).toMatch(/declined, cancelled or the friendship ended/);
  });
});

describe('friend UI actions and failure recovery', () => {
  it('shows accepted friends with a direct chat link and keeps terminal users out of search', async () => {
    show();
    await screen.findByText('Bob');
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute('href', '/messages/direct/2');
    fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'Finn' } });
    expect(screen.getByText(/No people found/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add friend' })).not.toBeInTheDocument();
  });
  it('accepts a received request and removes it from the request tab', async () => {
    show('requests');
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    await screen.findByRole('heading', { name: 'No friend requests' });
    expect(friendService.update).toHaveBeenCalledWith(3, { status: 'accepted' });
  });
  it('asks before declining a request and leaves it untouched when the dialog is closed', async () => {
    show('requests');
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = screen.getByRole('dialog', { name: 'Decline the request from Carol?' });
    expect(within(dialog).getByText(/Neither of you can send a new friend request/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Go back' }));
    expect(friendService.update).not.toHaveBeenCalled();
    expect(screen.getByText('Carol')).toBeVisible();
  });
  it('persists a confirmed block, hides the old row and supports unblock in the blocked tab', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Block' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, block' }));
    await waitFor(() => expect(friendService.update).toHaveBeenCalledWith(2, { user_blocked_other: 'true' }));
    await screen.findByRole('heading', { name: 'No friends yet' });
    fireEvent.click(screen.getByRole('link', { name: /Blocked/ }));
    const bob = screen.getAllByRole('listitem').find(item => item.textContent.includes('Bob'));
    fireEvent.click(within(bob).getByRole('button', { name: 'Unblock' }));
    await waitFor(() => expect(friendService.update).toHaveBeenLastCalledWith(2, { user_blocked_other: 'false' }));
  });
  it('retains the search on failed creation and removes the candidate after a successful retry', async () => {
    friendService.create.mockRejectedValueOnce(new Error('Request unavailable'));
    show();
    await screen.findByText('Bob');
    fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'Grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add friend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Request unavailable');
    expect(screen.getByLabelText('Search people')).toHaveValue('Grace');
    fireEvent.click(screen.getByRole('button', { name: 'Add friend' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Friend request sent to Grace.');
    expect(screen.getByLabelText('Search people')).toHaveValue('');
    expect(friendService.create).toHaveBeenLastCalledWith({ other_user_id: 7 });
  });
  it('reloads memberships after a conflict so stale candidates disappear', async () => {
    friendService.create.mockRejectedValueOnce({ status: 409 });
    show();
    await screen.findByText('Bob');
    friendService.list.mockResolvedValue([...rows, { id: 15, user_id: 1, other_user_id: 7, status: 'pending' }]);
    fireEvent.change(screen.getByLabelText('Search people'), { target: { value: 'Grace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add friend' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already have a friend record/);
    await waitFor(() => expect(screen.getByLabelText('Search people')).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'Add friend' })).not.toBeInTheDocument();
  });
  it('refreshes after friend events and removes the listener on unmount', async () => {
    const { unmount } = show('requests');
    await screen.findByText('Carol');
    friendService.list.mockResolvedValue([]);
    await act(async () => { for (const callback of live.listeners) callback({ type: 'friend.updated' }); });
    expect(await screen.findByRole('heading', { name: 'No friend requests' })).toBeVisible();
    unmount();
    expect(live.listeners.size).toBe(0);
  });
  it('shows request failures without consuming the request or hiding retry controls', async () => {
    friendService.update.mockRejectedValueOnce(new Error('Try again later'));
    show('requests');
    fireEvent.click(await screen.findByRole('button', { name: 'Accept' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again later');
    expect(screen.getByText('Carol')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeEnabled();
  });
});
