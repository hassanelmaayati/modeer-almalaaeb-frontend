import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import sportService from '../services/sportService';
import roomService from '../services/roomService';
import { getRoomFilters, toApiFilters, validateRoomFilters, withHomeGovernorate } from '../lib/helpers/filters';
import useAction from '../lib/helpers/useAction';
import HomeGameCard from '../components/home/HomeGameCard';
import { StadiumArt } from '../components/home/HeroArt';
import SportPicker from '../components/home/SportPicker';
import RoomFilters from '../components/activities/RoomFilters';
import NearMeFilter from '../components/activities/NearMeFilter';
import RoomList from '../components/activities/RoomList';
import CreateRoomAction from '../components/activities/CreateRoomAction';
import RoomPreviewDialog from '../components/activities/RoomPreviewDialog';
import { listen } from '../services/websocketService';
import { roomEvent } from '../lib/helpers/live';

const PAGE = 20;
const MAX_RELOAD = 100;

export default function SportsPage({ session = { user: null, loading: false } }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRoom, setSelectedRoom] = useState(null);
  const listRef = useRef(null);
  // "Near me" lives only in memory (not in the URL or storage), so a shared link never carries a location.
  const [near, setNear] = useState(null);
  const [radius, setRadius] = useState(10);
  // A signed-in user's home governorate is the default filter until they pick another (or all).
  const filters = withHomeGovernorate(getRoomFilters(searchParams), session.user);
  const [sports, setSports] = useState(() => emptyResource([]));
  const [rooms, setRooms] = useState(() => emptyResource({ items: [], total: null }));
  const [sportsRetry, setSportsRetry] = useState(0);
  const [roomsRetry, setRoomsRetry] = useState(0);
  const reloadSports = () => setSportsRetry((count) => count + 1);
  const reloadRooms = () => setRoomsRetry((count) => count + 1);
  const more = useAction();
  const loaded = useRef({ key: '', count: 0 });

  const query = useMemo(() => {
    const values = withHomeGovernorate(getRoomFilters(searchParams), session.user);
    const params = { ...toApiFilters(values), ...(near ? { near_lat: near.lat, near_lng: near.lng, radius_km: radius } : {}) };
    return { problem: validateRoomFilters(values), params, key: JSON.stringify(params) };
  }, [searchParams, session.user, near, radius]);

  useEffect(() => startRequest((signal) => sportService.list({ signal }), setSports), [sportsRetry]);
  useEffect(() => startRequest(async (signal) => {
    if (query.problem) throw new Error(query.problem);
    // A live refresh reloads as many rooms as are already on screen, so "Load more" is not undone.
    const same = loaded.current.key === query.key;
    loaded.current.key = query.key;
    const limit = same ? Math.min(Math.max(loaded.current.count, PAGE), MAX_RELOAD) : PAGE;
    return roomService.listPage({ ...query.params, limit, offset: 0 }, { signal });
  }, setRooms), [query, roomsRetry]);
  useEffect(() => { loaded.current.count = rooms.data.items.length; }, [rooms.data]);
  useEffect(() => listen(event => { if (event.type === 'connection.ready' || roomEvent(event)) setRoomsRetry(count => count + 1); }), []);

  // Picking a sport (here or from the home page) jumps straight to its games.
  useEffect(() => {
    if (filters.sport_id) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [filters.sport_id]);

  const { items, total } = rooms.data;
  const hasMore = total != null ? items.length < total : items.length > 0 && items.length % PAGE === 0;
  const loadMore = () => more.run(async () => {
    const page = await roomService.listPage({ ...query.params, limit: PAGE, offset: items.length });
    setRooms(previous => {
      const known = new Set(previous.data.items.map(room => room.id));
      return { ...previous, data: { items: [...previous.data.items, ...page.items.filter(room => !known.has(room.id))], total: page.total ?? previous.data.total } };
    });
  });
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
              <p className="home-subtitle">{rooms.loading || rooms.error ? 'Real people. Real activities. Across Bahrain.' : `${total ?? items.length} ${(total ?? items.length) === 1 ? 'activity' : 'activities'} found`}</p>
            </div>
            <button type="button" className="button-outline sports-refresh" onClick={reloadRooms}>Refresh activities</button>
          </div>
          <RoomFilters key={`${searchParams.toString()}-${filters.district}-${sports.loading}`} filters={filters} sports={sports.data} onApply={(values) => setSearchParams(values)} onClear={() => setSearchParams({})} />
          <NearMeFilter near={near} radius={radius} onNear={setNear} onRadius={setRadius} />
          <RoomList Card={HomeGameCard} rooms={items} sports={sports.data} loading={rooms.loading && !items.length} error={rooms.error} onRetry={reloadRooms} onPreview={setSelectedRoom} />
          {more.error && <p role="alert" className="error-message">{more.error}</p>}
          {hasMore && <div className="actions"><button type="button" className="button-secondary" disabled={more.pending} onClick={loadMore}>{more.pending ? 'Loading…' : 'Load more activities'}</button></div>}
        </section>
      </div>
      {selectedRoom && <RoomPreviewDialog key={`${selectedRoom.id}-${session.user?.id || 'guest'}`} session={session} room={selectedRoom} sportName={sports.data.find((sport) => sport.id === selectedRoom.sport_id)?.name} onClose={() => setSelectedRoom(null)} onUpdated={reloadRooms} />}
    </main>
  );
}
