import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import RoomForm from '../components/activities/RoomForm';
import { HostArt } from '../components/home/HeroArt';
import AsyncState from '../components/common/AsyncState';
import { emptyResource, startRequest } from '../lib/helpers/request';
import { occupiedPlaces } from '../lib/helpers/memberships';
import groupService from '../services/groupService';
import roomMemberService from '../services/roomMemberService';
import roomService from '../services/roomService';
import sportService from '../services/sportService';

function Blocked({ roomId, title, text }) {
  return <section className="panel">
    <h2>{title}</h2>
    <p>{text}</p>
    <Link className="button-secondary" to={`/rooms/${roomId}`}>Back to the room</Link>
  </section>;
}

let loadCount = 0;

export default function EditRoomPage({ session }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const userId = session.user?.id;
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => startRequest(async (signal) => {
    const [room, sports, groups, members] = await Promise.all([
      roomService.get(roomId, { signal }),
      sportService.list({ signal }),
      groupService.mine({ signal }),
      roomMemberService.list(roomId, { signal }),
    ]);
    return {
      loadId: ++loadCount,
      room,
      sports,
      groups: groups.filter((group) => group.owner_id === userId),
      occupied: occupiedPlaces(room, members),
    };
  }, setResource), [roomId, userId, retry]);

  const room = resource.data?.room;
  const isHost = Boolean(room && userId != null && String(room.host_id) === String(userId));

  function reload() {
    setNotice('Loaded the latest version of this room.');
    setRetry((count) => count + 1);
  }

  async function save(body) {
    await roomService.update(roomId, body);
    navigate(`/rooms/${roomId}`, { state: { saved: true } });
  }

  return <main className="home host-scope">
    <div className="home-content">
    <section className="sports-banner host-banner" aria-labelledby="edit-room-title">
      <HostArt />
      <div>
        <p className="sports-banner-eyebrow">Change the plan.</p>
        <h1 id="edit-room-title">Edit room</h1>
        <p>Update the details of your game while it is still open.</p>
      </div>
    </section>
    <AsyncState loading={resource.loading} error={resource.error} onRetry={() => setRetry((count) => count + 1)}>
      {room && !isHost && (
        <Blocked roomId={roomId} title="Only the host can edit this room" text="Ask the host if something about this room needs to change." />
      )}
      {room && isHost && room.status !== 'open' && (
        <Blocked roomId={roomId} title="This room can no longer be edited" text="Only open rooms can be edited. Rooms that have started, finished or been cancelled stay as they are." />
      )}
      {room && isHost && room.status === 'open' && notice && <p role="status">{notice}</p>}
      {room && isHost && room.status === 'open' && (
        <RoomForm
          key={resource.data.loadId}
          room={room}
          sports={resource.data.sports}
          groups={resource.data.groups}
          occupied={resource.data.occupied}
          onSubmit={save}
          onCancel={() => navigate(`/rooms/${roomId}`)}
          onReload={reload}
        />
      )}
    </AsyncState>
    </div>
  </main>;
}
