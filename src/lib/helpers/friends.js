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

export const FRIEND_TABS = [
  {
    value: 'friends',
    label: 'Friends',
    group: 'friends',
    rowLabel: 'Friend',
    empty: { title: 'No friends yet', description: 'Add friends to message them directly.' },
  },
  {
    value: 'requests',
    label: 'Requests',
    group: 'received',
    rowLabel: 'Wants to be your friend',
    empty: { title: 'No friend requests', description: 'When someone sends you a request, it will show up here.' },
  },
  {
    value: 'sent',
    label: 'Sent',
    group: 'sent',
    rowLabel: 'Waiting for a reply',
    empty: { title: 'No sent requests', description: 'Requests you send wait here until the other person answers.' },
  },
  {
    value: 'blocked',
    label: 'Blocked',
    group: 'blocked',
    rowLabel: 'Blocked',
    empty: { title: 'No blocked people', description: "People you block can't message you." },
  },
];

export const DEFAULT_FRIEND_TAB = 'friends';

export function friendTab(value) {
  return FRIEND_TABS.find((tab) => tab.value === value) || FRIEND_TABS[0];
}

export const CONFIRMED_FRIEND_ACTIONS = ['decline', 'cancel', 'unfriend', 'block'];

export const FRIEND_CONFIRMATIONS = {
  unfriend: (name) => ({
    title: `Unfriend ${name}?`,
    text: "You will no longer be able to message each other, though old messages stay readable. Neither of you can send a new friend request afterwards.",
    confirm: 'Yes, unfriend',
  }),
  block: (name) => ({
    title: `Block ${name}?`,
    text: "Neither of you will be able to send messages. You stay friends, and you can unblock them at any time.",
    confirm: 'Yes, block',
  }),
  decline: (name) => ({
    title: `Decline the request from ${name}?`,
    text: "Neither of you can send a new friend request afterwards.",
    confirm: 'Yes, decline',
  }),
  cancel: (name) => ({
    title: `Cancel your request to ${name}?`,
    text: "You can't send them a new friend request afterwards.",
    confirm: 'Yes, cancel request',
  }),
};

export function friendUpdateFor(kind, friendship) {
  if (kind === 'block') return blockUpdate(friendship, true);
  if (kind === 'unblock') return blockUpdate(friendship, false);
  return FRIEND_ACTIONS[kind];
}

export function replaceFriendship(rows, updated) {
  return rows.map((row) => (row.id === updated.id ? updated : row));
}
