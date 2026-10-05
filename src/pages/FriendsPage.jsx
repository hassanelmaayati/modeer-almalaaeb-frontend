import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import FriendRow from '../components/friends/FriendRow';
import FriendTabs from '../components/friends/FriendTabs';
import AsyncState from '../components/common/AsyncState';
import { friendTab, groupFriendships } from '../lib/helpers/friends';
import { playerName } from '../lib/helpers/groups';
import { emptyResource, startRequest } from '../lib/helpers/request';
import friendService from '../services/friendService';
import userService from '../services/userService';

export default function FriendsPage({ session }) {
  const [searchParams] = useSearchParams();
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
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

  return <main>
    <header className="page-header">
      <h1>Friends</h1>
      <p>Add friends to message them directly.</p>
    </header>
    <AsyncState loading={resource.loading} error={resource.error} onRetry={() => setRetry((count) => count + 1)}>
      <FriendTabs current={tab.value} groups={groups} />
      <AsyncState isEmpty={items.length === 0} emptyTitle={tab.empty.title} emptyDescription={tab.empty.description}>
        <ul className="friend-list">
          {items.map((friendship) => (
            <FriendRow
              key={friendship.row.id}
              userId={friendship.otherUserId}
              name={playerName(resource.data.users, friendship.otherUserId)}
              label={tab.rowLabel}
            />
          ))}
        </ul>
      </AsyncState>
    </AsyncState>
  </main>;
}
