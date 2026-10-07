/** Places left as text plus a small fill bar; the bar only means something while the room is open. */
export default function RoomPlaces({ room }) {
  // slots_left is optional in the API, so only quote it (and draw the bar) when it is there.
  const open = room.status === 'open' && room.slots_left != null;
  const label = open ? `${room.slots_left} of ${room.capacity} places left` : `${room.capacity} places`;
  const taken = open && room.capacity > 0 ? Math.min(100, Math.max(0, Math.round(((room.capacity - room.slots_left) / room.capacity) * 100))) : null;
  return <div className="room-places">
    <span className="room-places-label">{label}</span>
    {taken !== null && <span className={`room-places-bar${taken >= 100 ? ' is-full' : ''}`} aria-hidden="true"><span style={{ width: `${taken}%` }} /></span>}
  </div>;
}
