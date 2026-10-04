import { Link } from 'react-router';
import CupStatusBadge from './CupStatusBadge';
import { formatActivityDate, formatActivityTime } from '../../lib/helpers/date';
import { formatLabel } from '../../lib/helpers/cups';

export default function CupCard({ cup, sportName }) {
  const { organizer } = cup;
  return <article className="cup-card">
    <span className="eyebrow">{sportName || 'Activity'} · {formatLabel(cup.format)}</span>
    <h3><Link to={`/cups/${cup.id}`}>{cup.name}</Link></h3>
    <div className="card-meta">
      <CupStatusBadge status={cup.status} />
      <span>{cup.team_count} teams</span>
      <span>Up to {cup.roster_limit} players per team</span>
    </div>
    {cup.registration_closes_at && <p>Registration closes {formatActivityDate(cup.registration_closes_at)} · {formatActivityTime(cup.registration_closes_at)} <span className="muted">(Bahrain)</span></p>}
    {organizer && <p className="cup-organizer">
      {organizer.photo_url && <img className="avatar" src={organizer.photo_url} alt="" loading="lazy" />}
      Organized by <Link to={`/users/${organizer.id}`}>{organizer.user_name}</Link>
    </p>}
  </article>;
}
