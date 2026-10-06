import { useEffect, useState } from 'react';
import AsyncState from '../common/AsyncState';
import ratingService from '../../services/ratingService';
import { emptyResource, startRequest } from '../../lib/helpers/request';

/** Public average player rating of a profile, e.g. "4.3 ★ · 12 ratings". */
export default function AttendanceRatingSummary({ userId }) {
  const [summary, setSummary] = useState(() => emptyResource());
  const [retry, setRetry] = useState(0);
  useEffect(() => startRequest(signal => ratingService.getForUser(userId, { signal }), setSummary), [userId, retry]);

  const average = Number(summary.data?.average_rating);
  const count = summary.data?.rating_count ?? 0;
  return <section className="rating-summary" aria-labelledby="rating-summary-title">
    <h2 id="rating-summary-title">Player rating</h2>
    <AsyncState loading={summary.loading} error={summary.error} onRetry={() => setRetry(value => value + 1)}>
      {/* average_rating is null until someone has rated this player. */}
      {summary.data?.average_rating == null || !Number.isFinite(average) || count === 0
        ? <p className="muted">No ratings yet</p>
        : <p><strong>{average.toFixed(1)} <span aria-hidden="true">★</span><span className="visually-hidden"> out of 5 stars</span></strong> · {count} {count === 1 ? 'rating' : 'ratings'}</p>}
    </AsyncState>
  </section>;
}
