import { describe, expect, it } from 'vitest';
import {
  addFriendCandidates,
  addFriendError,
  blockUpdate,
  CONFIRMED_FRIEND_ACTIONS,
  describeFriendship,
  FRIEND_ACTIONS,
  FRIEND_CONFIRMATIONS,
  friendshipWith,
  friendUpdateFor,
  groupFriendships,
  isBlockedFlag,
  relatedUserIds,
  replaceFriendship,
  searchPeople,
} from '../../src/lib/helpers/friends';

const ME = 1;
const row = (id, userId, otherUserId, status, extra = {}) => ({
  id,
  user_id: userId,
  other_user_id: otherUserId,
  status,
  requested: true,
  accepted: status === 'accepted',
  user_blocked_other: null,
  other_blocked_user: null,
  ...extra,
});

describe('isBlockedFlag', () => {
  it('treats empty, false, 0, no and none as unblocked, in any case', () => {
    for (const value of [null, undefined, '', ' ', 'false', 'FALSE', '0', 'No', 'none', ' none ']) expect(isBlockedFlag(value)).toBe(false);
  });

  it('treats any other text as blocked', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', 'blocked']) expect(isBlockedFlag(value)).toBe(true);
  });
});

describe('describeFriendship', () => {
  it('shows the other person and the role from your point of view', () => {
    expect(describeFriendship(row(1, ME, 2, 'accepted'), ME)).toMatchObject({ otherUserId: 2, role: 'friend', requester: true });
    expect(describeFriendship(row(2, 3, ME, 'accepted'), ME)).toMatchObject({ otherUserId: 3, role: 'friend', requester: false });
    expect(describeFriendship(row(3, ME, 4, 'pending'), ME)).toMatchObject({ otherUserId: 4, role: 'sent' });
    expect(describeFriendship(row(4, 5, ME, 'pending'), ME)).toMatchObject({ otherUserId: 5, role: 'received' });
    expect(describeFriendship(row(5, ME, 6, 'declined'), ME).role).toBe('declined');
    expect(describeFriendship(row(6, 7, ME, 'left'), ME).role).toBe('left');
  });

  it('reads your own block flag and the other person\'s, whichever side you are on', () => {
    const asRequester = describeFriendship(row(1, ME, 2, 'accepted', { user_blocked_other: 'true', other_blocked_user: 'false' }), ME);
    expect(asRequester).toMatchObject({ blockedByMe: true, blockedMe: false });
    const asReceiver = describeFriendship(row(2, 3, ME, 'accepted', { user_blocked_other: 'true', other_blocked_user: 'no' }), ME);
    expect(asReceiver).toMatchObject({ blockedByMe: false, blockedMe: true });
  });
});

describe('groupFriendships', () => {
  const rows = [
    row(1, ME, 2, 'accepted'),
    row(2, 3, ME, 'accepted'),
    row(3, ME, 4, 'pending'),
    row(4, 5, ME, 'pending'),
    row(5, ME, 6, 'declined'),
    row(6, 7, ME, 'left'),
    row(7, ME, 8, 'accepted', { user_blocked_other: 'true' }),
    row(8, 9, ME, 'pending', { other_blocked_user: 'true' }),
    row(9, 10, ME, 'accepted', { user_blocked_other: 'true' }),
  ];
  const groups = groupFriendships(rows, ME);
  const ids = (list) => list.map((item) => item.otherUserId);

  it('sorts accepted, received and sent rows into their tabs', () => {
    expect(ids(groups.friends)).toEqual([2, 3, 10]);
    expect(ids(groups.received)).toEqual([5]);
    expect(ids(groups.sent)).toEqual([4]);
  });

  it('puts only people you blocked under blocked, whatever the status', () => {
    expect(ids(groups.blocked)).toEqual([8, 9]);
  });

  it('leaves declined and left rows out of every tab', () => {
    const everyone = [...groups.friends, ...groups.received, ...groups.sent, ...groups.blocked].map((item) => item.otherUserId);
    expect(everyone).not.toContain(6);
    expect(everyone).not.toContain(7);
  });
});

describe('looking people up', () => {
  const rows = [row(1, ME, 2, 'accepted'), row(2, 3, ME, 'pending'), row(3, ME, 4, 'declined')];

  it('finds the friendship with one person', () => {
    expect(friendshipWith(rows, ME, 3)).toMatchObject({ role: 'received', otherUserId: 3 });
    expect(friendshipWith(rows, ME, '2')).toMatchObject({ role: 'friend' });
    expect(friendshipWith(rows, ME, 99)).toBeNull();
  });

  it('knows everyone you already have a record with, including declined ones', () => {
    expect([...relatedUserIds(rows, ME)].sort()).toEqual([2, 3, 4]);
  });

  it('offers only people without a record, and never yourself', () => {
    const users = [1, 2, 3, 4, 5, 6].map((id) => ({ id, user_name: `User ${id}` }));
    expect(addFriendCandidates(users, rows, ME).map((user) => user.id)).toEqual([5, 6]);
  });
});

describe('updates', () => {
  it('sets the block flag that belongs to you', () => {
    const asRequester = describeFriendship(row(1, ME, 2, 'accepted'), ME);
    const asReceiver = describeFriendship(row(2, 3, ME, 'accepted'), ME);
    expect(blockUpdate(asRequester, true)).toEqual({ user_blocked_other: 'true' });
    expect(blockUpdate(asRequester, false)).toEqual({ user_blocked_other: 'false' });
    expect(blockUpdate(asReceiver, true)).toEqual({ other_blocked_user: 'true' });
    expect(blockUpdate(asReceiver, false)).toEqual({ other_blocked_user: 'false' });
  });

  it('maps each action to the status the backend expects', () => {
    expect(FRIEND_ACTIONS).toEqual({
      accept: { status: 'accepted' },
      decline: { status: 'declined' },
      unfriend: { status: 'left' },
      cancel: { status: 'left' },
    });
  });
});

describe('row actions', () => {
  const asRequester = describeFriendship(row(1, ME, 2, 'accepted'), ME);
  const asReceiver = describeFriendship(row(2, 3, ME, 'accepted'), ME);

  it('builds the update for each action', () => {
    expect(friendUpdateFor('accept', asReceiver)).toEqual({ status: 'accepted' });
    expect(friendUpdateFor('decline', asReceiver)).toEqual({ status: 'declined' });
    expect(friendUpdateFor('cancel', asRequester)).toEqual({ status: 'left' });
    expect(friendUpdateFor('unfriend', asRequester)).toEqual({ status: 'left' });
    expect(friendUpdateFor('block', asRequester)).toEqual({ user_blocked_other: 'true' });
    expect(friendUpdateFor('unblock', asReceiver)).toEqual({ other_blocked_user: 'false' });
  });

  it('asks for confirmation on the actions that cannot simply be undone', () => {
    expect(CONFIRMED_FRIEND_ACTIONS).toEqual(['decline', 'cancel', 'unfriend', 'block']);
    for (const kind of CONFIRMED_FRIEND_ACTIONS) {
      const { title, text, confirm } = FRIEND_CONFIRMATIONS[kind]('Sara');
      expect(title).toContain('Sara');
      expect(text.length).toBeGreaterThan(0);
      expect(confirm).toMatch(/^Yes, /);
    }
  });

  it('swaps one updated row into the list and leaves the rest alone', () => {
    const rows = [row(1, ME, 2, 'accepted'), row(2, 3, ME, 'pending')];
    const updated = row(2, 3, ME, 'accepted');
    const result = replaceFriendship(rows, updated);
    expect(result).toEqual([rows[0], updated]);
    expect(result[0]).toBe(rows[0]);
  });
});

describe('adding people', () => {
  const people = ['Sara', 'Sarah Ali', 'Omar', 'Layla'].map((name, index) => ({ id: index + 2, user_name: name }));

  it('searches names by any part, ignoring case and spaces around the text', () => {
    expect(searchPeople(people, ' SARA ').map((user) => user.user_name)).toEqual(['Sara', 'Sarah Ali']);
    expect(searchPeople(people, 'ali').map((user) => user.user_name)).toEqual(['Sarah Ali']);
    expect(searchPeople(people, 'zzz')).toEqual([]);
  });

  it('returns nothing for an empty search and caps the results', () => {
    expect(searchPeople(people, '')).toEqual([]);
    expect(searchPeople(people, '   ')).toEqual([]);
    const many = Array.from({ length: 20 }, (_, index) => ({ id: index, user_name: `Match${index}` }));
    expect(searchPeople(many, 'match')).toHaveLength(8);
    expect(searchPeople(many, 'match', 3)).toHaveLength(3);
  });

  it('explains the refusal for an existing record and passes other errors through', () => {
    expect(addFriendError({ status: 409, message: 'Friendship already exists' })).toMatch(/already have a friend record/);
    expect(addFriendError({ status: 500, message: 'Request failed (500).' })).toBe('Request failed (500).');
    expect(addFriendError(undefined)).toMatch(/Could not send the request/);
  });
});
