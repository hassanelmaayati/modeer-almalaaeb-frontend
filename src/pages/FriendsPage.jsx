import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import AsyncState from '../components/common/AsyncState';
import FriendActions from '../components/friends/FriendActions';
import FriendConfirmDialog from '../components/friends/FriendConfirmDialog';
import FriendRow from '../components/friends/FriendRow';
import FriendTabs from '../components/friends/FriendTabs';
import {
  CONFIRMED_FRIEND_ACTIONS,
  friendTab,
  friendUpdateFor,
  groupFriendships,
  replaceFriendship,
} from '../lib/helpers/friends';
import { playerName } from '../lib/helpers/groups';
import { emptyResource, startRequest } from '../lib/helpers/request';
import friendService from '../services/friendService';
import userService from '../services/userService';

export default function FriendsPage({ session }) {
  const [searchParams] = useSearchParams();
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [confirming, setConfirming] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState('');
  const userId = session.user?.id;
  const tab = friendTab(searchParams.get('tab'));

  useEffect(() => startRequest(async (signal) => {
    const [friendships, users] = await Promise.all([
      friendService.list({ signal }),
      userService.list({ signal }),
    ]);
    return { friendships, users };
  }, setResource), [userId, retry]);

  const groups = groupFriendships(resource.data?.friendships ?? [], userId);
  const items = groups[tab.group];
  const nameOf = (id) => playerName(resource.data?.users ?? [], id);

  async function apply(kind, friendship) {
    setPendingId(friendship.row.id);
    setError('');
    try {
      const updated = await friendService.update(friendship.otherUserId, friendUpdateFor(kind, friendship));
      setResource((previous) => ({
        ...previous,
        data: { ...previous.data, friendships: replaceFriendship(previous.data.friendships, updated) },
      }));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPendingId(null);
      setConfirming(null);
    }
  }

  function choose(kind, friendship) {
    if (CONFIRMED_FRIEND_ACTIONS.includes(kind)) setConfirming({ kind, friendship });
    else apply(kind, friendship);
  }

  return <main>
    <header className="page-header">
      <h1>Friends</h1>
      <p>Add friends to message them directly.</p>
    </header>
    {error && <p role="alert" className="error-message">{error}</p>}
    <AsyncState loading={resource.loading} error={resource.error} onRetry={() => setRetry((count) => count + 1)}>
      <FriendTabs current={tab.value} groups={groups} />
      <AsyncState isEmpty={items.length === 0} emptyTitle={tab.empty.title} emptyDescription={tab.empty.description}>
        <ul className="friend-list">
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
    {confirming && <FriendConfirmDialog
      request={confirming}
      name={nameOf(confirming.friendship.otherUserId)}
      pending={pendingId !== null}
      onConfirm={() => apply(confirming.kind, confirming.friendship)}
      onClose={() => setConfirming(null)}
    />}
  </main>;
}
