import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import sportService from '../services/sportService';
import roomService from '../services/roomService';
import { getRoomFilters, toApiFilters, validateRoomFilters, withHomeGovernorate } from '../lib/helpers/filters';
import HomeGameCard from '../components/home/HomeGameCard';
import { StadiumArt } from '../components/home/HeroArt';
import SportPicker from '../components/home/SportPicker';
import RoomFilters from '../components/activities/RoomFilters';
import RoomList from '../components/activities/RoomList';
import CreateRoomAction from '../components/activities/CreateRoomAction';
import RoomPreviewDialog from '../components/activities/RoomPreviewDialog';
import { listen } from '../services/websocketService';
import { roomEvent } from '../lib/helpers/live';

export default function SportsPage({ session = { user: null, loading: false } }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const listRef = useRef(null);
  // A signed-in user's home governorate is the default filter until they pick another (or all).
  const filters = withHomeGovernorate(getRoomFilters(searchParams), session.user);
  const [sports, setSports] = useState(() => emptyResource([]));
  const [rooms, setRooms] = useState(() => emptyResource([]));
  const [sportsRetry, setSportsRetry] = useState(0);
  const [roomsRetry, setRoomsRetry] = useState(0);
  const reloadSports = () => setSportsRetry((count) => count + 1);
  const reloadRooms = () => setRoomsRetry((count) => count + 1);

  useEffect(() => startRequest((signal) => sportService.list({ signal }), setSports), [sportsRetry]);
  useEffect(() => startRequest((signal) => {
    const values = withHomeGovernorate(getRoomFilters(searchParams), session.user);
    const problem = validateRoomFilters(values);
    if (problem) throw new Error(problem);
    return roomService.list(toApiFilters(values), { signal });
  }, setRooms), [searchParams, roomsRetry, session.user]);
  useEffect(() => listen(event => { if (event.type === 'connection.ready' || roomEvent(event)) setRoomsRetry(count => count + 1); }), []);

  // Picking a sport (here or from the home page) jumps straight to its games.
  useEffect(() => {
    if (filters.sport_id) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [filters.sport_id]);

  const activeSport = sports.data.find((sport) => String(sport.id) === filters.sport_id);

  return (
    <main className="home">
      <div className="home-content">
        <section className="sports-banner" aria-labelledby="sports-hero-title">
          <div>
            <p className="sports-banner-eyebrow">Play. Walk. Run. Ride.</p>
            <h1 id="sports-hero-title">Choose your activity</h1>
            <p>Team sports and shared outdoor sessions start with finding your people.</p>
          </div>
          <StadiumArt />
          <div className="sports-banner-actions">
            <a className="button-outline" href="#sports-discovery-title">Browse activities</a>
            <CreateRoomAction session={session} className="button-primary" label="Host a room" signedOutLabel="Sign in to host a room" />
          </div>
        </section>
        <SportPicker sports={sports.data} loading={sports.loading} error={sports.error} onRetry={reloadSports} activeId={filters.sport_id} title="Pick a sport" subtitle="Tap a sport to see its activities, or browse everything below." />
        <section ref={listRef} className="home-section sports-list" aria-labelledby="sports-discovery-title">
          <div className="home-section-head">
            <div>
              <h2 id="sports-discovery-title">{activeSport ? `${activeSport.name} activities` : 'Browse activities'}</h2>
              <p className="home-subtitle">{rooms.loading || rooms.error ? 'Real people. Real activities. Across Bahrain.' : `${rooms.data.length} ${rooms.data.length === 1 ? 'activity' : 'activities'} found`}</p>
            </div>
            <button type="button" className="button-outline sports-refresh" onClick={reloadRooms}>Refresh activities</button>
          </div>
          <RoomFilters key={`${searchParams.toString()}-${filters.district}-${sports.loading}`} filters={filters} sports={sports.data} onApply={(values) => setSearchParams(values)} onClear={() => setSearchParams({})} />
          <RoomList Card={HomeGameCard} rooms={rooms.data} sports={sports.data} loading={rooms.loading} error={rooms.error} onRetry={reloadRooms} onPreview={setSelectedRoom} />
        </section>
      </div>
      {selectedRoom && <RoomPreviewDialog key={`${selectedRoom.id}-${session.user?.id || 'guest'}`} session={session} room={selectedRoom} sportName={sports.data.find((sport) => sport.id === selectedRoom.sport_id)?.name} onClose={() => setSelectedRoom(null)} onUpdated={reloadRooms} />}
    </main>
  );
}
