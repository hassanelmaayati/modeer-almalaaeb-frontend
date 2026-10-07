import { useEffect, useState } from 'react';
import AsyncState from '../common/AsyncState';
import StarPicker from '../common/StarPicker';
import ratingService from '../../services/ratingService';
import useAction from '../../lib/helpers/useAction';
import { playerName } from '../../lib/helpers/groups';
import { emptyResource, startRequest } from '../../lib/helpers/request';
import { ratablePlayerIds, starsLabel } from '../../lib/helpers/ratings';

/** "Rate players" for a completed room; renders nothing unless the signed-in user took part and isn't the host. */
export default function RatePlayers({ room, members, users, user }) {
  const ids = ratablePlayerIds(room, members, user?.id);
  if (!ids) return null;
  return <RatePlayersList roomId={room.id} hostId={room.host_id} ids={ids} users={users} />;
}

function RatePlayersList({ roomId, hostId, ids, users }) {
  const [mine, setMine] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  useEffect(() => startRequest(signal => ratingService.listMine(roomId, { signal }), setMine), [roomId, retry]);
  const given = new Map((mine.data || []).map(rating => [rating.user_id, rating.stars]));

  async function rate(userId, stars) {
    try {
      await ratingService.give(roomId, { user_id: userId, stars });
    } catch (failure) {
      // 409 can mean "already rated" (for example from another tab): reload so that row locks.
      if (failure.status === 409) setRetry(value => value + 1);
      throw failure;
    }
    setMine(previous => ({ ...previous, data: [...(previous.data || []).filter(rating => rating.user_id !== userId), { user_id: userId, stars }] }));
  }

  return <section className="panel" aria-labelledby="rate-players-title">
    <h2 id="rate-players-title">Rate players</h2>
    <p className="muted">Rate the people you played with from 1 to 5 stars. Ratings are final and can't be changed.</p>
    {/* Only block on the first load: a reload after a 409 must not unmount rows and lose their error message. */}
    <AsyncState loading={mine.loading && !mine.data} error={mine.data ? null : mine.error} onRetry={() => setRetry(value => value + 1)}>
      <ul className="rate-players">
        {ids.map(id => <li key={id}><PlayerRatingRow name={playerName(users, id)} isHost={id === hostId} userId={id} given={given.get(id)} onRate={rate} /></li>)}
      </ul>
    </AsyncState>
  </section>;
}

/** One person's 1-5 star picker. `given` locks it (ratings are final); the backend's message shows on any failure, e.g. 409 already rated. */
export function PlayerRatingRow({ userId, name, isHost = false, given, onRate }) {
  const [stars, setStars] = useState(0);
  const { pending, error, run } = useAction();
  const locked = given != null;

  function submit(event) {
    event.preventDefault();
    if (!stars) return;
    if (!window.confirm(`Ratings are final. Give ${name} ${starsLabel(stars)}?`)) return;
    run(() => onRate(userId, stars));
  }

  return <div className="rate-player">
    <form onSubmit={submit}>
      <StarPicker name={`rating-${userId}`} label={`Rating for ${name}${isHost ? ' (host)' : ''}`} value={locked ? given : stars} onChange={setStars} disabled={locked || pending} />
      {locked
        ? <p role="status" className="muted">You rated {name} {given} out of 5. Ratings are final.</p>
        : <button disabled={pending || !stars}>{pending ? 'Saving…' : `Submit rating for ${name}`}</button>}
      {error && <p role="alert">{error}</p>}
    </form>
  </div>;
}
