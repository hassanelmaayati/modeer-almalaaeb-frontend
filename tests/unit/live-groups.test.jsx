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

const live = vi.hoisted(() => ({ listeners: new Set() }));
vi.mock('../../src/services/websocketService', () => ({ listen: callback => { live.listeners.add(callback); return () => live.listeners.delete(callback); } }));
vi.mock('../../src/services/groupService', () => ({ default: { get: vi.fn(), list: vi.fn(), update: vi.fn() } }));
vi.mock('../../src/services/groupMemberService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/sportService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/userService', () => ({ default: { list: vi.fn() } }));
vi.mock('../../src/services/roomService', () => ({ default: { list: vi.fn() } }));

const group = { id: 3, name: 'Evening team', sports_id: 1, owner_id: 1, description: 'Friendly games' };
const users = [{ id: 1, user_name: 'Owner' }, { id: 2, user_name: 'Player' }];
const show = (path = '/groups', id = 2) => render(<MemoryRouter initialEntries={[path]}><GroupsPage session={{ user: users.find(user => user.id === id), loading: false }} /></MemoryRouter>);
async function emit(value) { await act(async () => { for (const callback of live.listeners) callback(value); }); }

beforeEach(() => {
  live.listeners.clear();
  groupService.list.mockReset().mockResolvedValue([group]);
  groupService.get.mockReset().mockResolvedValue(group);
  groupService.update.mockReset().mockResolvedValue(group);
  groupMemberService.list.mockReset().mockResolvedValue([{ id: 2, user_id: 2, status: 'accepted' }]);
  sportService.list.mockReset().mockResolvedValue([{ id: 1, name: 'Soccer' }]);
  userService.list.mockReset().mockResolvedValue(users);
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

  it('removes a group from the joined list after an authorized membership removal event', async () => {
    show();
    await screen.findByRole('heading', { name: 'Evening team' });
    groupMemberService.list.mockResolvedValue([{ id: 2, user_id: 2, status: 'removed' }]);
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
    await waitFor(() => expect(groupService.list).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue('My unsaved edit');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(groupService.update).toHaveBeenCalledWith(3, { name: 'Evening team', description: 'My unsaved edit', photo_url: null });
  });
});
