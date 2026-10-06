import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateGroupDialog from '../../src/components/groups/CreateGroupDialog';
import GroupForm from '../../src/components/groups/GroupForm';
import groupService from '../../src/services/groupService';
import groupMemberService from '../../src/services/groupMemberService';
import { filterGroups, inviteCandidates } from '../../src/lib/helpers/groups';

vi.mock('../../src/services/groupService', () => ({ default: { create: vi.fn() } }));
vi.mock('../../src/services/groupMemberService', () => ({ default: { invite: vi.fn() } }));

const sports = [{ id: 1, name: 'Soccer' }];
const users = [{ id: 1, user_name: 'Owner' }, { id: 2, user_name: 'Player Two' }, { id: 3, user_name: 'Player Three' }];

beforeEach(() => { vi.clearAllMocks(); });

describe('group membership views', () => {
  const groups = [
    { id: 1, owner_id: 1, name: 'Owned team', sportName: 'Soccer', sports_id: 1, members: [] },
    { id: 2, owner_id: 2, name: 'Joined team', sportName: 'Soccer', sports_id: 1, members: [{ user_id: 1, status: 'accepted' }] },
    { id: 3, owner_id: 2, name: 'Invitation', sportName: 'Basketball', sports_id: 2, members: [{ user_id: 1, status: 'pending' }] },
    { id: 4, owner_id: 2, name: 'Left team', sportName: 'Soccer', sports_id: 1, members: [{ user_id: 1, status: 'left' }] },
  ];
  it('includes ownership without inventing a membership and separates pending invitations', () => {
    expect(filterGroups(groups, 1).map((group) => group.id)).toEqual([1, 2]);
    expect(filterGroups(groups, 1, { view: 'invitations' }).map((group) => group.id)).toEqual([3]);
    expect(filterGroups(groups, 1, { search: ' joined ', sportId: '1' }).map((group) => group.id)).toEqual([2]);
  });
  it('excludes every existing membership from reinvitation, including terminal states', () => {
    expect(inviteCandidates(users, 1, [{ user_id: 2, status: 'removed' }])).toEqual([users[2]]);
    expect(inviteCandidates(users, 1, [{ user_id: 2, status: 'left' }, { user_id: 3, status: 'declined' }])).toEqual([]);
  });
});

it('keeps a created group when an invitation fails and does not repeat group creation', async () => {
  const events = userEvent.setup();
  groupService.create.mockResolvedValue({ id: 8, name: 'Evening Team', sports_id: 1, owner_id: 1 });
  groupMemberService.invite.mockImplementation((_groupId, userId) => userId === 2 ? Promise.reject(new Error('Already invited')) : Promise.resolve({ status: 'pending' }));
  const onCreated = vi.fn();
  const onOpenGroup = vi.fn();
  render(<CreateGroupDialog sports={sports} users={users} userId={1} onClose={vi.fn()} onCreated={onCreated} onOpenGroup={onOpenGroup} />);
  await events.type(screen.getByLabelText('Group name'), ' Evening Team ');
  await events.selectOptions(screen.getByLabelText('Sport'), '1');
  await events.selectOptions(screen.getByLabelText('Invite players (optional)'), ['2', '3']);
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
