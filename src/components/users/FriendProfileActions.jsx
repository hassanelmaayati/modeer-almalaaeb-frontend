import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import AsyncState from '../common/AsyncState';
import FriendConfirmDialog from '../friends/FriendConfirmDialog';
import {
  addFriendError,
  CONFIRMED_FRIEND_ACTIONS,
  friendshipWith,
  friendUpdateFor,
  replaceFriendship,
} from '../../lib/helpers/friends';
import { emptyResource, startRequest } from '../../lib/helpers/request';
import useFriendEvents from '../../lib/helpers/useFriendEvents';
import friendService from '../../services/friendService';

export default function FriendProfileActions({ viewerId, user }) {
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [confirming, setConfirming] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => startRequest((signal) => friendService.list({ signal }), setResource), [viewerId, user.id, retry]);

  useFriendEvents(() => {
    friendService.list()
      .then((friendships) => setResource({ data: friendships, loading: false, error: null }))
      .catch(() => {});
  });

  const friendship = friendshipWith(resource.data ?? [], viewerId, user.id);

  async function run(task) {
    setPending(true);
    setError('');
    try {
      await task();
    } catch (failure) {
      setError(addFriendError(failure));
      if (failure?.status === 409) setRetry((count) => count + 1);
    } finally {
      setPending(false);
      setConfirming(null);
    }
  }

  const addFriend = () => run(async () => {
    const created = await friendService.create({ other_user_id: user.id });
    setResource((previous) => ({ ...previous, data: [...previous.data, created] }));
  });

  const apply = (kind) => run(async () => {
    const updated = await friendService.update(user.id, friendUpdateFor(kind, friendship));
    setResource((previous) => ({ ...previous, data: replaceFriendship(previous.data, updated) }));
  });

  function choose(kind) {
    if (CONFIRMED_FRIEND_ACTIONS.includes(kind)) setConfirming({ kind, friendship });
    else apply(kind);
  }

  const button = (kind, label, secondary = true) => (
    <button type="button" className={secondary ? 'button-secondary' : 'button'} disabled={pending} onClick={() => choose(kind)}>{label}</button>
  );

  let content;
  if (!friendship) {
    content = <button type="button" className="button" disabled={pending} onClick={addFriend}>Add friend</button>;
  } else if (friendship.blockedByMe) {
    content = <>
      <span className="status-badge">Blocked</span>
      {button('unblock', 'Unblock')}
    </>;
  } else if (friendship.role === 'friend') {
    content = <>
      <span className="status-badge">Friends</span>
      <Link className="button" to={`/messages/direct/${user.id}`}>Message</Link>
    </>;
  } else if (friendship.role === 'sent') {
    content = <>
      <span className="status-badge">Request sent</span>
      {button('cancel', 'Cancel request')}
    </>;
  } else if (friendship.role === 'received') {
    content = <>
      <span className="status-badge">Wants to be your friend</span>
      {button('accept', 'Accept request', false)}
      {button('decline', 'Decline')}
    </>;
  } else {
    content = <p className="muted">You can't send a friend request to this person.</p>;
  }

  return <section aria-label="Friendship">
    {error && <p role="alert" className="error-message">{error}</p>}
    <AsyncState loading={resource.loading} error={resource.error} onRetry={() => setRetry((count) => count + 1)}>
      <div className="button-row">{content}</div>
    </AsyncState>
    {confirming && <FriendConfirmDialog
      request={confirming}
      name={user.user_name}
      pending={pending}
      onConfirm={() => apply(confirming.kind)}
      onClose={() => setConfirming(null)}
    />}
  </section>;
}
