import { formatActivityDate, formatActivityTime } from '../../lib/helpers/date';
import { playersNeeded } from '../../lib/helpers/home';
import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';

export default function HomeGameCard({ room, sportName, onPreview }) {
  const instant = room.admission_policy === 'open';
  return <article className="game-card">
    <SportIcon name={sportName} size={54} className="game-card-icon" />
    <div className="game-card-body">
      <h3>{room.title}</h3>
      <ul>
        <li><Icon name="pin" />{room.area}</li>
        <li><Icon name="calendar" />{room.starts_at ? `${formatActivityDate(room.starts_at)} · ${formatActivityTime(room.starts_at)}` : 'Time shared after joining'}</li>
        {room.km_away != null && <li><Icon name="pin" />{room.km_away < 1 ? 'less than 1 km away' : `about ${room.km_away} km away`}</li>}
        <li><Icon name="people" />{playersNeeded(room)}</li>
        <li><Icon name={instant ? 'bolt' : 'lock'} />{instant ? 'Instant join' : 'Host approval'}</li>
      </ul>
    </div>
    <button type="button" className="button-primary" onClick={() => onPreview(room)} aria-label={`View game: ${room.title}`}>View game</button>
  </article>;
}
