import { Link } from 'react-router';
import AsyncState from '../common/AsyncState';
import SportIcon from '../common/SportIcon';

export default function SportPicker({ sports, loading, error, onRetry, activeId, title = 'Choose your sport', subtitle = 'Play what you love. A stronger community through sport.' }) {
  return <section className="home-section" aria-labelledby="home-sports-title">
    <h2 id="home-sports-title">{title}</h2>
    <p className="home-subtitle">{subtitle}</p>
    <AsyncState loading={loading} error={error} onRetry={onRetry} isEmpty={sports.length === 0} emptyTitle="No sports available" emptyDescription="Check back soon for new sports.">
      <ul className="sport-tiles">
        {sports.map((sport) => <li key={sport.id}>
          <Link className="sport-tile" aria-current={String(sport.id) === activeId ? 'true' : undefined} to={`/sports?sport_id=${encodeURIComponent(sport.id)}`}>
            <SportIcon name={sport.name} size={52} />
            <span>{sport.name}</span>
          </Link>
        </li>)}
      </ul>
    </AsyncState>
  </section>;
}
