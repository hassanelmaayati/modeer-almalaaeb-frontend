// Participants are the host plus accepted members who did not no-show; the backend enforces the same rule (403 otherwise).
const tookPart = member => member.status === 'accepted' && member.attendance !== 'no_show';

/**
 * User ids the signed-in user may rate in this room, or null when the "Rate players" section must stay hidden.
 * Only completed rooms, and only for participants other than the host (the host doesn't use player ratings in their own room).
 */
export function ratablePlayerIds(room, members, userId) {
  if (!room || room.status !== 'completed' || userId == null || userId === room.host_id) return null;
  const own = members.find(member => member.user_id === userId);
  if (!own || !tookPart(own)) return null;
  // Players can rate the host, who may have no member row of their own, so the host is added explicitly.
  const ids = new Set([room.host_id, ...members.filter(tookPart).map(member => member.user_id)]);
  ids.delete(userId);
  return [...ids];
}

export const starsLabel = stars => `${stars} ${stars === 1 ? 'star' : 'stars'}`;
