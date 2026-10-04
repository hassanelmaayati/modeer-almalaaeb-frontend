import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import sportService from '../services/sportService';
import roomService from '../services/roomService';
import { getRoomFilters, validateRoomFilters } from '../lib/helpers/filters';
import ActivityCard from '../components/activities/ActivityCard';
import RoomFilters from '../components/activities/RoomFilters';
import RoomList from '../components/activities/RoomList';
import RoomPreviewDialog from '../components/activities/RoomPreviewDialog';
import AsyncState from '../components/common/AsyncState';
import { listen } from '../services/websocketService';
import { roomEvent } from '../lib/helpers/live';

export default function SportsPage({ session = { user: null, loading: false } }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const filters = getRoomFilters(searchParams);
  const [sports, setSports] = useState(() => emptyResource([]));
  const [rooms, setRooms] = useState(() => emptyResource([]));
  const [sportsRetry, setSportsRetry] = useState(0);
  const [roomsRetry, setRoomsRetry] = useState(0);
  const reloadSports = () => setSportsRetry((count) => count + 1);
  const reloadRooms = () => setRoomsRetry((count) => count + 1);

  useEffect(() => startRequest((signal) => sportService.list({ signal }), setSports), [sportsRetry]);
  useEffect(() => startRequest((signal) => {
    const values = getRoomFilters(searchParams);
    const problem = validateRoomFilters(values);
    if (problem) throw new Error(problem);
    return roomService.list(values, { signal });
  }, setRooms), [searchParams, roomsRetry]);
  useEffect(() => listen(event => { if (event.type === 'connection.ready' || roomEvent(event)) setRoomsRetry(count => count + 1); }), []);

  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">Play. Walk. Run. Ride.</p>
        <h1>Choose your activity</h1>
        <p>Team sports and shared outdoor sessions start with finding your people.</p>
      </header>
      <section className="page-section" aria-label="Activity catalogue">
        <AsyncState loading={sports.loading} error={sports.error} onRetry={reloadSports} isEmpty={sports.data.length === 0} emptyTitle="No activities available" emptyDescription="Check back soon for new activities.">
          <div className="card-grid activity-grid">
            {sports.data.map((sport) => <ActivityCard key={sport.id} sport={sport} />)}
          </div>
        </AsyncState>
      </section>
      <section className="page-section" aria-labelledby="sports-discovery-title">
        <div className="section-heading"><h2 id="sports-discovery-title">Browse activities</h2><button type="button" className="button-secondary" onClick={reloadRooms}>Refresh activities</button></div>
        <RoomFilters key={`${searchParams.toString()}-${sports.loading}`} filters={filters} sports={sports.data} onApply={(values) => setSearchParams(values)} onClear={() => setSearchParams({})} />
        <RoomList rooms={rooms.data} sports={sports.data} loading={rooms.loading} error={rooms.error} onRetry={reloadRooms} onPreview={setSelectedRoom} />
      </section>
      {selectedRoom && <RoomPreviewDialog key={`${selectedRoom.id}-${session.user?.id || 'guest'}`} session={session} room={selectedRoom} sportName={sports.data.find((sport) => sport.id === selectedRoom.sport_id)?.name} onClose={() => setSelectedRoom(null)} onUpdated={reloadRooms} />}
    </main>
  );
}
