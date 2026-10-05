import { formatActivitySchedule } from '../../lib/helpers/date';
import { DIFFICULTIES, DISTRICTS, optionLabel } from '../../lib/helpers/filters';

export default function RoomCard({ room, sportName, onPreview }) {
  return (
    <article className="room-card">
      <span className="eyebrow">{sportName || 'Activity'}</span>
      <h3>{room.title}</h3>
      <p>{formatActivitySchedule(room.starts_at, room.ends_at)} <span className="muted">(Bahrain)</span></p>
      <p>{room.area} · {optionLabel(DISTRICTS, room.district)}</p>
      <div className="card-meta">
        <span className="status-badge">{optionLabel(DIFFICULTIES, room.difficulty)}</span>
        <span>{room.capacity} places</span>
      </div>
      {room.description && <p className="card-description">{room.description}</p>}
      <button type="button" className="button-secondary" onClick={() => onPreview(room)}>View activity</button>
    </article>
  );
}
