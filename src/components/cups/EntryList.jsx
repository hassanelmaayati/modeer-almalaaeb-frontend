import { Link } from 'react-router';
import useAction from '../../lib/helpers/useAction';
import { formatActivityDate } from '../../lib/helpers/date';

const ORDER = ['accepted', 'pending', 'declined', 'withdrawn'];
const LABELS = { accepted: 'Accepted', pending: 'Waiting for organizer', declined: 'Declined', withdrawn: 'Withdrawn' };

export default function EntryList({ entries, rosters = { data: new Map() }, canReview, onReview }) {
  const { pending, error, run } = useAction();
  if (!entries.length) return <p className="muted">No teams have entered yet.</p>;
  const sorted = [...entries].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  return <>
    {error && <p role="alert">{error}</p>}
    <ul className="entry-list">
      {sorted.map(entry => <li key={entry.group_id} className="entry-card">
        <span className="entry-badge-initial" aria-hidden="true">{entry.group_name?.[0]?.toUpperCase()}</span>
        <div className="entry-card-body">
          <strong>{entry.group_name}</strong>
          <span className="muted">entered {formatActivityDate(entry.entered_at)}</span>
          {/* Only accepted teams play, so only their rosters are shown. */}
          {entry.status === 'accepted' && <TeamRoster members={rosters.data?.get(entry.group_id)} loading={rosters.loading} failed={!!rosters.error} />}
        </div>
        <span className={`status-badge entry-${entry.status}`}>{LABELS[entry.status] || entry.status}</span>
        {canReview && entry.status === 'pending' && <span className="actions">
          <button type="button" disabled={pending} onClick={() => run(() => onReview(entry.group_id, 'accepted'))}>Accept</button>
          <button type="button" className="button-secondary" disabled={pending} onClick={() => run(() => onReview(entry.group_id, 'declined'))}>Decline</button>
        </span>}
      </li>)}
    </ul>
  </>;
}

function TeamRoster({ members, loading, failed }) {
  if (loading) return null;
  if (failed) return <span className="muted">Roster unavailable.</span>;
  if (!members?.length) return <span className="muted">No confirmed players yet.</span>;
  return <ul className="entry-roster" aria-label="Roster">
    {members.map(member => <li key={member.id}><Link to={`/users/${member.id}`}>{member.user_name}</Link></li>)}
  </ul>;
}
