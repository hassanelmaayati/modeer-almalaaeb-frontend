import { Link } from 'react-router';

export default function ActivityCard({ sport, compact = false }) {
  return (
    <Link className={`activity-card${compact ? ' activity-card-compact' : ''}`} to={`/sports?sport_id=${encodeURIComponent(sport.id)}`}>
      <h3>{sport.name}</h3>
      {!compact && <><p>Find a shared {sport.name.toLowerCase()} activity in Bahrain.</p><span className="card-link">Browse rooms <span aria-hidden="true">→</span></span></>}
    </Link>
  );
}
