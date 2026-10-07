import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import AsyncState from '../components/common/AsyncState';
import AddFriend from '../components/friends/AddFriend';
import FriendActions from '../components/friends/FriendActions';
import FriendConfirmDialog from '../components/friends/FriendConfirmDialog';
import FriendRow from '../components/friends/FriendRow';
import FriendTabs from '../components/friends/FriendTabs';
import { FriendsArt } from '../components/home/HeroArt';
import {
  addFriendError,
  CONFIRMED_FRIEND_ACTIONS,
  friendTab,
  friendUpdateFor,
  groupFriendships,
  relatedUserIds,
  replaceFriendship,
} from '../lib/helpers/friends';
import { playerName } from '../lib/helpers/groups';
import { emptyResource, startRequest } from '../lib/helpers/request';
import useFriendEvents from '../lib/helpers/useFriendEvents';
import useUsers from '../lib/helpers/userDirectory';
import friendService from '../services/friendService';

export default function FriendsPage({ session }) {
  const [searchParams] = useSearchParams();
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [confirming, setConfirming] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const searchRef = useRef(null);
  const userId = session.user?.id;
  const tab = friendTab(searchParams.get('tab'));

  useEffect(() => startRequest((signal) => friendService.list({ signal }), setResource), [userId, retry]);

  useFriendEvents(() => {
    friendService.list()
      .then((friendships) => setResource({ data: friendships, loading: false, error: null }))
      .catch(() => {});
  });

  const friendships = resource.data ?? [];
  const groups = groupFriendships(friendships, userId);
  const items = groups[tab.group];
  // Only the people in these rows are looked up (by id), not the whole user table.
  const related = [...relatedUserIds(friendships, userId)];
  const users = useUsers(related);
  const nameOf = (id) => playerName(users, id);

  async function apply(kind, friendship) {
    setPendingId(friendship.row.id);
    setError('');
    setNotice('');
    try {
      const updated = await friendService.update(friendship.otherUserId, friendUpdateFor(kind, friendship));
      setResource((previous) => ({ ...previous, data: replaceFriendship(previous.data, updated) }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPendingId(null);
      setConfirming(null);
    }
  }

  async function addFriend(user) {
    setPendingId(user.id);
    setError('');
    setNotice('');
    try {
      const created = await friendService.create({ other_user_id: user.id });
      setResource((previous) => ({ ...previous, data: [...previous.data, created] }));
      setNotice(`Friend request sent to ${user.user_name}.`);
      return true;
    } catch (failure) {
      setError(addFriendError(failure));
      if (failure?.status === 409) setRetry((count) => count + 1);
      return false;
    } finally {
      setPendingId(null);
    }
  }

  function choose(kind, friendship) {
    if (CONFIRMED_FRIEND_ACTIONS.includes(kind)) setConfirming({ kind, friendship });
    else apply(kind, friendship);
  }

  return <main className="home friends-scope">
    <div className="home-content">
    <section className="sports-banner friends-banner" aria-labelledby="friends-title">
      <FriendsArt />
      <div>
        <p className="sports-banner-eyebrow">Teammates. Rivals. Friends.</p>
        <h1 id="friends-title">Friends</h1>
        <p>Add friends to message them directly.</p>
      </div>
    </section>
    {error && <p role="alert" className="error-message">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <AsyncState loading={resource.loading} error={resource.error} onRetry={() => setRetry((count) => count + 1)}>
      <AddFriend exclude={[userId, ...related]} disabled={pendingId !== null} onAdd={addFriend} inputRef={searchRef} />
      <FriendTabs current={tab.value} groups={groups} />
      <AsyncState
        isEmpty={items.length === 0}
        emptyTitle={tab.empty.title}
        emptyDescription={tab.empty.description}
        emptyAction={tab.empty.action === 'find'
          ? <button type="button" className="button-secondary" onClick={() => searchRef.current?.focus()}>Find people to add</button>
          : null}
      >
        <ul className={`friend-list friend-list-${tab.value}`}>
          {items.map((friendship) => (
            <FriendRow
              key={friendship.row.id}
              userId={friendship.otherUserId}
              name={nameOf(friendship.otherUserId)}
              label={tab.rowLabel}
            >
              <FriendActions
                tab={tab.value}
                friendship={friendship}
                disabled={pendingId !== null}
                onAction={choose}
              />
            </FriendRow>
          ))}
        </ul>
      </AsyncState>
    </AsyncState>
    </div>
    {confirming && <FriendConfirmDialog
      request={confirming}
      name={nameOf(confirming.friendship.otherUserId)}
      pending={pendingId !== null}
      onConfirm={() => apply(confirming.kind, confirming.friendship)}
      onClose={() => setConfirming(null)}
    />}
  </main>;
}
