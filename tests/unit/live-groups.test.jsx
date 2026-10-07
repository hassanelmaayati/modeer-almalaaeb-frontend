import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GroupsPage from '../../src/pages/GroupsPage';
import groupService from '../../src/services/groupService';
import groupMemberService from '../../src/services/groupMemberService';
import sportService from '../../src/services/sportService';
import userService from '../../src/services/userService';
import roomService from '../../src/services/roomService';
import { resetUserDirectory } from '../../src/lib/helpers/userDirectory';

const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));
vi.mock('../../src/services/groupService', () => ({ default: { get: vi.fn(), minePage: vi.fn(), update: vi.fn() } }));
vi.mock('../../src/services/groupMemberService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/userService', () => ({ default: { listByIds: vi.fn(), search: vi.fn() } }));
vi.mock('../../src/services/roomService', () => ({ default: { list: vi.fn() } }));

const group = { id: 3, name: 'Evening team', sports_id: 1, owner_id: 1, description: 'Friendly games' };
const users = [{ id: 1, user_name: 'Owner' }, { id: 2, user_name: 'Player' }];
const show = (path = '/groups', id = 2) => render(<MemoryRouter initialEntries={[path]}><GroupsPage session={{ user: users.find(user => user.id === id), loading: false }} /></MemoryRouter>);
async function emit(value) { await act(async () => { for (const callback of live.listeners) callback(value); }); }

beforeEach(() => {
  live.listeners.clear();
  resetUserDirectory();
  groupService.minePage.mockReset().mockResolvedValue({ items: [{ ...group, role: 'member', member_count: 2 }], total: 1 });
  groupService.get.mockReset().mockResolvedValue(group);
  groupService.update.mockReset().mockResolvedValue(group);
  groupMemberService.list.mockReset().mockResolvedValue([{ id: 2, user_id: 2, status: 'accepted' }]);
  sportService.list.mockReset().mockResolvedValue([{ id: 1, name: 'Soccer' }]);
  userService.listByIds.mockReset().mockImplementation(async ids => users.filter(user => ids.includes(user.id)));
  roomService.list.mockReset().mockResolvedValue([]);
});

describe('live group views', () => {
  it('opens a saved group notification destination and refreshes the dialog on its own event', async () => {
    show('/groups?group_id=3');
    const dialog = await screen.findByRole('dialog', { name: 'Evening team' });
    expect(within(dialog).getByText('Owner: Owner')).toBeInTheDocument();
    groupService.get.mockResolvedValue({ ...group, description: 'Updated by owner' });
    await emit({ type: 'group.updated', group_id: 3 });
    expect(await within(dialog).findByText('Updated by owner')).toBeInTheDocument();
    expect(groupService.get).toHaveBeenCalledTimes(2);
  });

  it('removes a group from your list after a group event says you were removed', async () => {
    show();
    await screen.findByRole('heading', { name: 'Evening team' });
    groupService.minePage.mockResolvedValue({ items: [], total: 0 });
    await emit({ type: 'group.updated', group_id: 3 });
    expect(await screen.findByRole('heading', { name: 'No groups found' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Evening team' })).not.toBeInTheDocument();
  });

  it('preserves an owner edit while live data changes, then saves supported fields', async () => {
    const user = userEvent.setup();
    show('/groups?group_id=3', 1);
    await user.click(await screen.findByRole('button', { name: 'Edit group' }));
    await user.clear(screen.getByRole('textbox', { name: 'Description' }));
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'My unsaved edit');
    await emit({ type: 'group.updated', group_id: 3 });
    await waitFor(() => expect(groupService.minePage).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('My unsaved edit');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(groupService.update).toHaveBeenCalledWith(3, { name: 'Evening team', description: 'My unsaved edit', photo_url: null });
  });

  it('does not reload your groups for room or friend events, only for group events', async () => {
    show();
    await screen.findByRole('heading', { name: 'Evening team' });
    const loads = groupService.minePage.mock.calls.length;
    await emit({ type: 'room.updated', room_id: 9 });
    await emit({ type: 'room_created', room: { id: 9 } });
    await emit({ type: 'friend.updated', direct_id: 4 });
    await emit({ type: 'membership.updated', room_id: 9 });
    expect(groupService.minePage).toHaveBeenCalledTimes(loads);
    await emit({ type: 'membership.updated', group_id: 3 });
    await waitFor(() => expect(groupService.minePage).toHaveBeenCalledTimes(loads + 1));
  });

  it('shows member counts from the list without asking for each group\'s members', async () => {
    show();
    expect(await screen.findByText('2 members')).toBeInTheDocument();
    expect(groupMemberService.list).not.toHaveBeenCalled();
  });

  it('loads more groups with the next offset and stops when everything is shown', async () => {
    const page = (start, count) => Array.from({ length: count }, (_, index) => ({ ...group, id: start + index, name: `Team ${start + index}`, role: 'member', member_count: 1 }));
    groupService.minePage.mockResolvedValueOnce({ items: page(10, 20), total: 22 }).mockResolvedValueOnce({ items: page(30, 2), total: 22 });
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole('button', { name: 'Load more groups' }));
    expect(await screen.findByRole('heading', { name: 'Team 31' })).toBeInTheDocument();
    expect(groupService.minePage.mock.calls.map(([query]) => query)).toEqual([{ limit: 20, offset: 0 }, { limit: 20, offset: 20 }]);
    expect(screen.queryByRole('button', { name: 'Load more groups' })).not.toBeInTheDocument();
  });
});
