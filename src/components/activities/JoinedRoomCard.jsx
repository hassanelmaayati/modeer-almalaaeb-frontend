import { Link } from 'react-router';
import Icon from '../common/Icon';
import SportIcon from '../common/SportIcon';
import RoomPlaces from './RoomPlaces';
import { formatActivitySchedule } from '../../lib/helpers/date';
import { DIFFICULTIES, DISTRICTS, optionLabel, ROOM_STATUS_OPTIONS } from '../../lib/helpers/filters';
import { joinedMembershipLabel } from '../../lib/helpers/rooms';

const ENDED_ROOM = ['completed', 'cancelled'];
const INACTIVE_MEMBERSHIP = ['declined', 'removed', 'left'];

export default function JoinedRoomCard({ room, sportName }) {
  const { membership } = room;
  const muted = ENDED_ROOM.includes(room.status) || INACTIVE_MEMBERSHIP.includes(membership.status);

  return (
    <article className={`${muted ? 'room-card is-muted' : 'room-card'} room-card-membership-${membership.status}`}>
      <header className="room-card-top">
        <span className="room-card-sport"><SportIcon name={sportName} size={30} /></span>
        <span className="eyebrow room-card-kicker">{sportName || 'Activity'}</span>
      </header>
      <h3>{room.title}</h3>
      <p className="room-row"><Icon name="calendar" /><span>{formatActivitySchedule(room.starts_at, room.ends_at)} <span className="muted">(Bahrain)</span></span></p>
      <p className="room-row"><Icon name="pin" /><span>{room.area} · {optionLabel(DISTRICTS, room.district)}</span></p>
      <div className="card-meta">
        <span className="status-badge">{joinedMembershipLabel(membership)}</span>
        <span className="status-badge">{optionLabel(ROOM_STATUS_OPTIONS, room.status)}</span>
        <span className="status-badge">{optionLabel(DIFFICULTIES, room.difficulty)}</span>
      </div>
      <RoomPlaces room={room} />
      {membership.position && <p className="room-note">Your position: {membership.position}</p>}
      {room.description && <p className="card-description">{room.description}</p>}
      {room.venue_notes && <p className="room-note">Meeting details: {room.venue_notes}</p>}
      <div className="button-row room-card-actions">
        <Link className="button-secondary" to={`/rooms/${room.id}`}>View room</Link>
      </div>
    </article>
  );
}
