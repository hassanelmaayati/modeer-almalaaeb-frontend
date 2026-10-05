import useAction from '../../lib/helpers/useAction';
import { formatActivityDate } from '../../lib/helpers/date';

const ORDER = ['accepted', 'pending', 'declined', 'withdrawn'];
const LABELS = { accepted: 'Accepted', pending: 'Waiting for organizer', declined: 'Declined', withdrawn: 'Withdrawn' };

export default function EntryList({ entries, canReview, onReview }) {
  const { pending, error, run } = useAction();
  if (!entries.length) return <p>No teams have entered yet.</p>;
  const sorted = [...entries].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  return <>
    {error && <p role="alert">{error}</p>}
    <ul className="entry-list">
      {sorted.map(entry => <li key={entry.group_id}>
        <strong>{entry.group_name}</strong>{' '}
        <span className={`status-badge entry-${entry.status}`}>{LABELS[entry.status] || entry.status}</span>{' '}
        <span className="muted">entered {formatActivityDate(entry.entered_at)}</span>
        {canReview && entry.status === 'pending' && <span className="actions">
          <button type="button" disabled={pending} onClick={() => run(() => onReview(entry.group_id, 'accepted'))}>Accept</button>
          <button type="button" className="button-secondary" disabled={pending} onClick={() => run(() => onReview(entry.group_id, 'declined'))}>Decline</button>
        </span>}
      </li>)}
    </ul>
  </>;
}
