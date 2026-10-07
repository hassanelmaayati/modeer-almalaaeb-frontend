import groupService from '../../services/groupService';
import sportService from '../../services/sportService';

export const GROUPS_PAGE_SIZE = 20;

/**
 * The role GET /groups/mine reports: 'owner', 'member', or 'invited' for a pending invitation.
 * The API describes role as a free string, so anything that looks like an invitation counts as one.
 */
export function groupRole(group) {
  const role = String(group.role || '').toLowerCase();
  if (role === 'owner') return 'owner';
  if (/invit|pending/.test(role)) return 'invited';
  return 'member';
}

const withSportName = (group, sports) => ({ ...group, sportName: sports.find(sport => sport.id === group.sports_id)?.name || 'Activity' });

/** One page of the user's groups (with member_count and role) plus the sports list. No per-group requests. */
export async function loadGroups(signal) {
  const [{ items, total }, sports] = await Promise.all([
    groupService.minePage({ limit: GROUPS_PAGE_SIZE, offset: 0 }, { signal }),
    sportService.list({ signal }),
  ]);
  return { sports, total, groups: items.map(group => withSportName(group, sports)) };
}

/** The next page, appended to what is already loaded. */
export async function loadMoreGroups(current) {
  const { items, total } = await groupService.minePage({ limit: GROUPS_PAGE_SIZE, offset: current.groups.length });
  const known = new Set(current.groups.map(group => group.id));
  return { ...current, total: total ?? current.total, groups: [...current.groups, ...items.filter(group => !known.has(group.id)).map(group => withSportName(group, current.sports))] };
}

export function filterGroups(groups, { view = 'joined', search = '', sportId = '' } = {}) {
  const needle = search.trim().toLowerCase();
  return groups.filter((group) => {
    const role = groupRole(group);
    const belongs = view === 'invitations' ? role === 'invited' : role !== 'invited';
    return belongs && (!sportId || String(group.sports_id) === sportId) &&
      (!needle || `${group.name} ${group.sportName}`.toLowerCase().includes(needle));
  });
}

export function playerName(users, userId) {
  return users.find((user) => user.id === userId)?.user_name || `Player ${userId}`;
}
