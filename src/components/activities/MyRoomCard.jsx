import { Link } from 'react-router';
import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';
import RoomPlaces from './RoomPlaces';
import { formatActivitySchedule } from '../../lib/helpers/date';
import {
  DIFFICULTIES,
  DISTRICTS,
  optionLabel,
  ROOM_STATUS_OPTIONS,
  VISIBILITY_OPTIONS,
} from '../../lib/helpers/filters';

const ENDED = ['completed', 'cancelled'];

export default function MyRoomCard({ room, sportName }) {
  const ended = ENDED.includes(room.status);

  return (
    <article className={`${ended ? 'room-card is-muted' : 'room-card'} room-card-${room.status}`}>
      <header className="room-card-top">
        <span className="room-card-sport"><SportIcon name={sportName} size={30} /></span>
        <span className="eyebrow room-card-kicker">{sportName || 'Activity'}</span>
      </header>
      <h3>{room.title}</h3>
      <p className="room-row"><Icon name="calendar" /><span>{formatActivitySchedule(room.starts_at, room.ends_at)} <span className="muted">(Bahrain)</span></span></p>
      <p className="room-row"><Icon name="pin" /><span>{room.area} · {optionLabel(DISTRICTS, room.district)}</span></p>
      <div className="card-meta">
        <span className="status-badge">{optionLabel(ROOM_STATUS_OPTIONS, room.status)}</span>
        <span className="status-badge">{optionLabel(VISIBILITY_OPTIONS, room.visibility)}</span>
        <span className="status-badge">{optionLabel(DIFFICULTIES, room.difficulty)}</span>
      </div>
      <RoomPlaces room={room} />
      {room.description && <p className="card-description">{room.description}</p>}
      <div className="button-row room-card-actions">
        <Link className="button-secondary" to={`/rooms/${room.id}`}>Manage</Link>
        {room.status === 'open' && <Link className="button-secondary" to={`/rooms/${room.id}/edit`}>Edit</Link>}
      </div>
    </article>
  );
}
