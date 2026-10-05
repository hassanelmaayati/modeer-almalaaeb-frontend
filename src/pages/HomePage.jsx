import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import sportService from '../services/sportService';
import roomService from '../services/roomService';
import ActivityCard from '../components/activities/ActivityCard';
import RoomList from '../components/activities/RoomList';
import CreateRoomAction from './components/activities/CreateRoomAction';
import RoomPreviewDialog from '../components/activities/RoomPreviewDialog';
import AsyncState from '../components/common/AsyncState';
import { listen } from '../services/websocketService';
import { roomEvent } from '../lib/helpers/live';

export default function HomePage({ session = { user: null, loading: false } }) {
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [sports, setSports] = useState(() => emptyResource([]));
  const [rooms, setRooms] = useState(() => emptyResource([]));
  const [sportsRetry, setSportsRetry] = useState(0);
  const [roomsRetry, setRoomsRetry] = useState(0);
  const reloadSports = () => setSportsRetry((count) => count + 1);
  const reloadRooms = () => setRoomsRetry((count) => count + 1);

  useEffect(() => startRequest((signal) => sportService.list({ signal }), setSports), [sportsRetry]);
  useEffect(() => startRequest((signal) => roomService.list({}, { signal }), setRooms), [roomsRetry]);
  useEffect(() => listen(event => { if (event.type === 'connection.ready' || roomEvent(event)) setRoomsRetry(count => count + 1); }), []);

  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">Activities across Bahrain</p>
        <h1>Find your people. Get moving.</h1>
        <p>Games, walks, runs and rides across Bahrain.</p>
      </header>
      <section className="home-hero" aria-label="Find your next activity">
        <div className="panel hero-panel">
          <h2>Find your next shared activity</h2>
          <p>Browse local activities, request a place and meet people who enjoy getting active.</p>
          <p className="muted">Hosts arrange venues separately. There is no checkout.</p>
          <Link className="button" to="/sports">Find an activity</Link>
          <CreateRoomAction session={session} className="button-secondary" />
        </div>
        <div className="panel how-it-works">
          <h2>How it works</h2>
          <ol><li>Choose an activity</li><li>Request a place</li><li>Meet up and take part</li></ol>
        </div>
      </section>
      <section className="page-section" aria-labelledby="home-activities-title">
        <div className="section-heading"><h2 id="home-activities-title">Choose an activity</h2><Link to="/sports">See all activities</Link></div>
        <AsyncState loading={sports.loading} error={sports.error} onRetry={reloadSports} isEmpty={sports.data.length === 0} emptyTitle="No activities available" emptyDescription="Check back soon for new activities.">
          <div className="card-grid activity-grid activity-grid-compact">
            {sports.data.map((sport) => <ActivityCard key={sport.id} sport={sport} compact />)}
          </div>
        </AsyncState>
      </section>
      <section className="page-section" aria-labelledby="home-upcoming-title">
        <div className="section-heading"><h2 id="home-upcoming-title">Upcoming activities</h2><Link to="/sports">Browse activities</Link></div>
        <RoomList rooms={rooms.data.slice(0, 2)} sports={sports.data} loading={rooms.loading} error={rooms.error} onRetry={reloadRooms} onPreview={setSelectedRoom} emptyDescription="No public activities are scheduled yet. Check back soon." />
      </section>
      {selectedRoom && <RoomPreviewDialog key={`${selectedRoom.id}-${session.user?.id || 'guest'}`} session={session} room={selectedRoom} sportName={sports.data.find((sport) => sport.id === selectedRoom.sport_id)?.name} onClose={() => setSelectedRoom(null)} onUpdated={reloadRooms} />}
    </main>
  );
}
