import { Link } from 'react-router';
import { formatActivitySchedule } from '../../lib/helpers/date';
import { DIFFICULTIES, DISTRICTS, optionLabel, ROOM_STATUS_OPTIONS } from '../../lib/helpers/filters';
import { joinedMembershipLabel } from '../../lib/helpers/rooms';

const ENDED_ROOM = ['completed', 'cancelled'];
const INACTIVE_MEMBERSHIP = ['declined', 'removed', 'left'];

export default function JoinedRoomCard({ room, sportName }) {
  const { membership } = room;
  const muted = ENDED_ROOM.includes(room.status) || INACTIVE_MEMBERSHIP.includes(membership.status);
  // slots_left is optional in the API, so only quote it when it is there.
  const places = room.status === 'open' && room.slots_left != null
    ? `${room.slots_left} of ${room.capacity} places left`
    : `${room.capacity} places`;

  return (
    <article className={muted ? 'room-card is-muted' : 'room-card'}>
      <span className="eyebrow">{sportName || 'Activity'}</span>
      <h3>{room.title}</h3>
      <p>{formatActivitySchedule(room.starts_at, room.ends_at)} <span className="muted">(Bahrain)</span></p>
      <p>{room.area} · {optionLabel(DISTRICTS, room.district)}</p>
      <div className="card-meta">
        <span className="status-badge">{joinedMembershipLabel(membership)}</span>
        <span className="status-badge">{optionLabel(ROOM_STATUS_OPTIONS, room.status)}</span>
        <span className="status-badge">{optionLabel(DIFFICULTIES, room.difficulty)}</span>
        <span>{places}</span>
      </div>
      {membership.position && <p>Your position: {membership.position}</p>}
      {room.description && <p className="card-description">{room.description}</p>}
      {room.venue_notes && <p>Meeting details: {room.venue_notes}</p>}
      <Link className="button-secondary" to={`/rooms/${room.id}`}>View room</Link>
    </article>
  );
}
