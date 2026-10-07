import { Link } from 'react-router';
import CupStatusBadge from './CupStatusBadge';
import CupDeadline from './CupDeadline';
import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';
import { TrophyArt } from '../home/HeroArt';
import { parseDate } from '../../lib/helpers/date';
import { formatLabel } from '../../lib/helpers/cups';

const DAY = 24 * 60 * 60 * 1000;

// Only worth shouting about while people can still enter.
function countdown(cup) {
  const closes = cup.status === 'registration' && cup.registration_closes_at && parseDate(cup.registration_closes_at);
  if (!closes) return null;
  const left = closes.getTime() - Date.now();
  if (left <= 0) return { text: 'Registration closed', urgent: false };
  const days = Math.ceil(left / DAY);
  return { text: days <= 1 ? 'Closes today' : `${days} days left to enter`, urgent: days <= 3 };
}

export default function CupCard({ cup, sportName }) {
  const { organizer } = cup;
  const timer = countdown(cup);
  return <article className={`cup-card cup-card-${cup.status}`}>
    <TrophyArt size={120} />
    <header className="cup-card-top">
      <span className="cup-card-sport"><SportIcon name={sportName} size={30} /></span>
      <span className="cup-card-kicker">{sportName || 'Activity'}</span>
      <CupStatusBadge status={cup.status} />
    </header>
    <h3><Link to={`/cups/${cup.id}`}>{cup.name}</Link></h3>
    <ul className="cup-chips">
      <li><Icon name="bolt" />{formatLabel(cup.format)}</li>
      <li><Icon name="people" />{cup.team_count} teams</li>
      <li><Icon name="people" />{cup.roster_limit} {cup.roster_limit === 1 ? 'player' : 'players'} per team</li>
    </ul>
    {/* The deadline only matters while people can still enter. */}
    <CupDeadline closesAt={['draft', 'registration'].includes(cup.status) ? cup.registration_closes_at : null}>
      {timer && <strong className={`cup-countdown${timer.urgent ? ' is-urgent' : ''}`}>{timer.text}</strong>}
    </CupDeadline>
    <footer className="cup-card-foot">
      {organizer && <span className="cup-organizer">
        {organizer.photo_url
          ? <img className="avatar" src={organizer.photo_url} alt="" loading="lazy" />
          : <span className="cup-organizer-initial" aria-hidden="true">{organizer.user_name?.[0]?.toUpperCase()}</span>}
        <span>by <Link to={`/users/${organizer.id}`}>{organizer.user_name}</Link></span>
      </span>}
      <span className="cup-card-cta" aria-hidden="true">View cup <Icon name="arrow" size={16} /></span>
    </footer>
  </article>;
}
