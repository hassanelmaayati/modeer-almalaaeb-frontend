import { findOwnMembership } from './memberships';
import groupService from '../../services/groupService';
import groupMemberService from '../../services/groupMemberService';
import sportService from '../../services/sportService';
import userService from '../../services/userService';

export async function loadGroups(signal) {
  const [groups, sports, users] = await Promise.all([
    groupService.list({ signal }), sportService.list({ signal }), userService.list({ signal }),
  ]);
  const memberships = await Promise.allSettled(groups.map(group => groupMemberService.list(group.id, { signal })));
  return { sports, users, groups: groups.map((group, index) => ({
    ...group, sportName: sports.find(sport => sport.id === group.sports_id)?.name || 'Activity',
    members: memberships[index].status === 'fulfilled' ? memberships[index].value : null,
    membershipError: memberships[index].status === 'rejected' ? memberships[index].reason : null,
  })) };
}

export function filterGroups(groups, userId, { view = 'joined', search = '', sportId = '' } = {}) {
  const needle = search.trim().toLowerCase();
  return groups.filter((group) => {
    const membership = findOwnMembership(group.members || [], userId);
    const belongs = view === 'invitations' ? membership?.status === 'pending' :
      group.owner_id === userId || membership?.status === 'accepted';
    return belongs && (!sportId || String(group.sports_id) === sportId) &&
      (!needle || `${group.name} ${group.sportName}`.toLowerCase().includes(needle));
  });
}

export function inviteCandidates(users, ownerId, members = []) {
  const existing = new Set(members.map((member) => member.user_id));
  return users.filter((user) => user.id !== ownerId && !existing.has(user.id));
}

export function playerName(users, userId) {
  return users.find((user) => user.id === userId)?.user_name || `Player ${userId}`;
}
