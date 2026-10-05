import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import AsyncState from '../components/common/AsyncState';
import { emptyResource, startRequest } from '../lib/helpers/request';
import roomService from '../services/roomService';

function Blocked({ roomId, title, text }) {
  return <section className="panel">
    <h2>{title}</h2>
    <p>{text}</p>
    <Link className="button-secondary" to={`/rooms/${roomId}`}>Back to the room</Link>
  </section>;
}

export default function EditRoomPage({ session }) {
  const { roomId } = useParams();
  const userId = session.user?.id;
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);

  useEffect(() => startRequest((signal) => roomService.get(roomId, { signal }), setResource), [roomId, userId, retry]);

  const room = resource.data;
  const isHost = Boolean(room && userId != null && String(room.host_id) === String(userId));

  return <main>
    <h1>Edit room</h1>
    <AsyncState loading={resource.loading} error={resource.error} onRetry={() => setRetry((count) => count + 1)}>
      {room && !isHost && (
        <Blocked roomId={roomId} title="Only the host can edit this room" text="Ask the host if something about this room needs to change." />
      )}
      {room && isHost && room.status !== 'open' && (
        <Blocked roomId={roomId} title="This room can no longer be edited" text="Only open rooms can be edited. Rooms that have started, finished or been cancelled stay as they are." />
      )}
      {room && isHost && room.status === 'open' && (
        <p>Editing "{room.title}".</p>
      )}
    </AsyncState>
  </main>;
}
