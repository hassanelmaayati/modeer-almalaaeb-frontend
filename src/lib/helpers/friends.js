const UNBLOCKED_VALUES = ['', 'false', '0', 'no', 'none'];

export function isBlockedFlag(value) {
  if (value === null || value === undefined) return false;
  return !UNBLOCKED_VALUES.includes(String(value).trim().toLowerCase());
}

export function describeFriendship(row, userId) {
  const requester = String(row.user_id) === String(userId);
  const otherUserId = requester ? row.other_user_id : row.user_id;
  let role = row.status;
  if (row.status === 'accepted') role = 'friend';
  if (row.status === 'pending') role = requester ? 'sent' : 'received';
  return {
    row,
    otherUserId,
    role,
    requester,
    blockedByMe: isBlockedFlag(requester ? row.user_blocked_other : row.other_blocked_user),
    blockedMe: isBlockedFlag(requester ? row.other_blocked_user : row.user_blocked_other),
  };
}

export function groupFriendships(rows, userId) {
  const groups = { friends: [], received: [], sent: [], blocked: [] };
  for (const row of rows) {
    const friendship = describeFriendship(row, userId);
    if (friendship.blockedByMe) groups.blocked.push(friendship);
    else if (friendship.role === 'friend') groups.friends.push(friendship);
    else if (friendship.role === 'received') groups.received.push(friendship);
    else if (friendship.role === 'sent') groups.sent.push(friendship);
  }
  return groups;
}

export function friendshipWith(rows, userId, otherUserId) {
  const row = rows.find((item) => {
    const friendship = describeFriendship(item, userId);
    return String(friendship.otherUserId) === String(otherUserId);
  });
  return row ? describeFriendship(row, userId) : null;
}

export function relatedUserIds(rows, userId) {
  return new Set(rows.map((row) => describeFriendship(row, userId).otherUserId));
}

export function addFriendCandidates(users, rows, userId) {
  const related = relatedUserIds(rows, userId);
  return users.filter((user) => user.id !== userId && !related.has(user.id));
}

export function blockUpdate(friendship, blocked) {
  const field = friendship.requester ? 'user_blocked_other' : 'other_blocked_user';
  return { [field]: blocked ? 'true' : 'false' };
}

export const FRIEND_ACTIONS = {
  accept: { status: 'accepted' },
  decline: { status: 'declined' },
  unfriend: { status: 'left' },
  cancel: { status: 'left' },
};
