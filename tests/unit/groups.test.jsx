import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateGroupDialog from '../../src/components/groups/CreateGroupDialog';
import GroupForm from '../../src/components/groups/GroupForm';
import groupService from '../../src/services/groupService';
import groupMemberService from '../../src/services/groupMemberService';
import userService from '../../src/services/userService';
import { filterGroups, groupRole } from '../../src/lib/helpers/groups';

vi.mock('../../src/services/groupService', () => ({ default: { create: vi.fn() } }));
vi.mock('../../src/services/groupMemberService', () => ({ default: { invite: vi.fn() } }));
vi.mock('../../src/services/userService', () => ({ default: { search: vi.fn(), listByIds: vi.fn() } }));

const sports = [{ id: 1, name: 'Soccer' }];
const users = [{ id: 1, user_name: 'Owner' }, { id: 2, user_name: 'Player Two' }, { id: 3, user_name: 'Player Three' }];

beforeEach(() => {
  vi.clearAllMocks();
  userService.listByIds.mockImplementation(async (ids) => users.filter((user) => ids.includes(user.id)));
  userService.search.mockImplementation(async (text) => users.filter((user) => user.user_name.toLowerCase().includes(text.toLowerCase())));
});

describe('group membership views', () => {
  const groups = [
    { id: 1, owner_id: 1, name: 'Owned team', sportName: 'Soccer', sports_id: 1, role: 'owner', member_count: 1 },
    { id: 2, owner_id: 2, name: 'Joined team', sportName: 'Soccer', sports_id: 1, role: 'member', member_count: 5 },
    { id: 3, owner_id: 2, name: 'Invitation', sportName: 'Basketball', sports_id: 2, role: 'invited', member_count: 3 },
  ];
  it('separates your groups from pending invitations using the role from /groups/mine', () => {
    expect(filterGroups(groups).map((group) => group.id)).toEqual([1, 2]);
    expect(filterGroups(groups, { view: 'invitations' }).map((group) => group.id)).toEqual([3]);
    expect(filterGroups(groups, { search: ' joined ', sportId: '1' }).map((group) => group.id)).toEqual([2]);
  });
  it.each([['owner', 'owner'], ['OWNER', 'owner'], ['member', 'member'], ['accepted', 'member'], ['invited', 'invited'], ['pending_invitation', 'invited'], [undefined, 'member']])('reads the role %s as %s', (role, expected) => {
    expect(groupRole({ role })).toBe(expected);
  });
});

it('keeps a created group when an invitation fails and does not repeat group creation', async () => {
  const events = userEvent.setup();
  groupService.create.mockResolvedValue({ id: 8, name: 'Evening Team', sports_id: 1, owner_id: 1 });
  groupMemberService.invite.mockImplementation((_groupId, userId) => userId === 2 ? Promise.reject(new Error('Already invited')) : Promise.resolve({ status: 'pending' }));
  const onCreated = vi.fn();
  const onOpenGroup = vi.fn();
  render(<CreateGroupDialog sports={sports} userId={1} onClose={vi.fn()} onCreated={onCreated} onOpenGroup={onOpenGroup} />);
  await events.type(screen.getByLabelText('Group name'), ' Evening Team ');
  await events.selectOptions(screen.getByLabelText('Sport'), '1');
  // Players are found by searching and added one by one.
  await events.type(screen.getByLabelText('Search people'), 'Player');
  await events.click(await screen.findByRole('button', { name: 'Invite Player Two' }));
  await events.type(screen.getByLabelText('Search people'), 'Player');
  await events.click(await screen.findByRole('button', { name: 'Invite Player Three' }));
  await events.click(screen.getByRole('button', { name: 'Create group', exact: true }));
  await expect(screen.findByRole('status')).resolves.toHaveTextContent('Evening Team was created.');
  expect(screen.getByRole('alert')).toHaveTextContent('Player Two: Already invited');
  expect(groupService.create).toHaveBeenCalledExactlyOnceWith({ name: 'Evening Team', description: null, photo_url: null, sports_id: 1 });
  expect(onCreated).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: 'Create group', exact: true })).not.toBeInTheDocument();
  await events.click(screen.getByRole('button', { name: 'Open group', exact: true }));
  expect(onOpenGroup).toHaveBeenCalledExactlyOnceWith(8);
  expect(groupService.create).toHaveBeenCalledOnce();
});

it('retains edits after a server error and sends the required name without a sport update', async () => {
  const events = userEvent.setup();
  const onSubmit = vi.fn().mockRejectedValue(new Error('Not authorized to update this group'));
  render(<GroupForm group={{ id: 1, name: 'Team', sports_id: 1 }} sports={sports} onSubmit={onSubmit} onCancel={vi.fn()} />);
  await events.type(screen.getByLabelText('Description'), 'Evening games');
  await events.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Not authorized'));
  expect(screen.getByLabelText('Description')).toHaveValue('Evening games');
  expect(onSubmit).toHaveBeenCalledExactlyOnceWith({ name: 'Team', description: 'Evening games', photo_url: null }, []);
  expect(screen.queryByLabelText('Sport')).not.toBeInTheDocument();
});

it('rejects a non-https group photo URL before calling the backend', async () => {
  const onSubmit = vi.fn();
  render(<GroupForm group={{ id: 1, name: 'Team', sports_id: 1 }} sports={sports} onSubmit={onSubmit} onCancel={vi.fn()} />);
  // fireEvent.submit skips native type=url checks, so this exercises the app's own validation.
  for (const url of ['ftp://example.test/team.png', 'http://example.test/team.png']) {
    fireEvent.change(screen.getByLabelText('Photo URL'), { target: { value: url } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Photo URL must be a secure web address starting with https://.');
  }
  expect(onSubmit).not.toHaveBeenCalled();
});
