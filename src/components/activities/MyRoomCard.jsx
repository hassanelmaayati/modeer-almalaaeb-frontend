import { Link } from 'react-router';
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
  const places = room.status === 'open'
    ? `${room.slots_left} of ${room.capacity} places left`
    : `${room.capacity} places`;

  return (
    <article className={ended ? 'room-card is-muted' : 'room-card'}>
      <span className="eyebrow">{sportName || 'Activity'}</span>
      <h3>{room.title}</h3>
      <p>{formatActivitySchedule(room.starts_at, room.ends_at)} <span className="muted">(Bahrain)</span></p>
      <p>{room.area} · {optionLabel(DISTRICTS, room.district)}</p>
      <div className="card-meta">
        <span className="status-badge">{optionLabel(ROOM_STATUS_OPTIONS, room.status)}</span>
        <span className="status-badge">{optionLabel(VISIBILITY_OPTIONS, room.visibility)}</span>
        <span className="status-badge">{optionLabel(DIFFICULTIES, room.difficulty)}</span>
        <span>{places}</span>
      </div>
      {room.description && <p className="card-description">{room.description}</p>}
      <Link className="button-secondary" to={`/rooms/${room.id}`}>Manage</Link>
    </article>
  );
}
