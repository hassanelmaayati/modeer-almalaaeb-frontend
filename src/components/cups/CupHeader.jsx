import { Link } from 'react-router';
import CupDeadline from './CupDeadline';
import CupStatusBadge from './CupStatusBadge';
import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';
import { BracketArt } from '../home/HeroArt';
import { formatLabel } from '../../lib/helpers/cups';

export default function CupHeader({ cup, sportName }) {
  const { organizer } = cup;
  return <header className="cup-header">
    <section className="sports-banner cups-banner">
      <BracketArt />
      <div className="cups-banner-title">
        <div>
          <p className="sports-banner-eyebrow">{sportName || 'Activity'}<span className="format-pill">{formatLabel(cup.format)}</span></p>
          <h1>{cup.name}</h1>
          <p className="cup-organizer">
            {organizer.photo_url && <img className="avatar" src={organizer.photo_url} alt="" />}
            Organized by <Link to={`/users/${organizer.id}`}>{organizer.user_name}</Link>
          </p>
        </div>
      </div>
      <SportIcon name={sportName} size={64} className="cup-header-sport" />
    </section>
    <ul className="cup-facts">
      <li><CupStatusBadge status={cup.status} /></li>
      <li><Icon name="people" />{cup.team_count} teams</li>
      <li><Icon name="people" />Up to {cup.roster_limit} {cup.roster_limit === 1 ? 'player' : 'players'} per team</li>
      {cup.registration_closes_at && <li><CupDeadline closesAt={cup.registration_closes_at} /></li>}
    </ul>
    <section className="home-section cup-rules-card" aria-labelledby="cup-rules-title">
      <h2 id="cup-rules-title">Rules</h2>
      <p className="cup-rules">{cup.rules}</p>
    </section>
  </header>;
}
