import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { emptyResource, startRequest } from '../lib/helpers/request';
import sportService from '../services/sportService';
import roomService from '../services/roomService';
import RoomList from '../components/activities/RoomList';
import Logo from '../components/common/Logo';
import Icon from '../components/common/Icon';
import HomeGameCard from '../components/home/HomeGameCard';
import HomeHero from '../components/home/HomeHero';
import HowItWorks from '../components/home/HowItWorks';
import SportPicker from '../components/home/SportPicker';
import RoomPreviewDialog from '../components/activities/RoomPreviewDialog';
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
  // Signed-in users with a home governorate see rooms there first; everyone else sees all rooms.
  const governorate = session.user?.district;
  useEffect(() => startRequest((signal) => roomService.list(governorate ? { district: governorate } : {}, { signal }), setRooms), [roomsRetry, governorate]);
  useEffect(() => listen(event => { if (event.type === 'connection.ready' || roomEvent(event)) setRoomsRetry(count => count + 1); }), []);

  const games = rooms.data.slice(0, 3);

  return (
    <main className="home">
      <HomeHero session={session} />
      <div className="home-content">
        <SportPicker sports={sports.data} loading={sports.loading} error={sports.error} onRetry={reloadSports} />
        <HowItWorks />
        <section className="home-section" aria-labelledby="home-upcoming-title">
          <div className="home-section-head">
            <div>
              <h2 id="home-upcoming-title">Upcoming public games</h2>
              <p className="home-subtitle">Real people. Real games. Across Bahrain.</p>
            </div>
            <Link className="home-link" to="/sports">View all games <Icon name="arrow" size={16} /></Link>
          </div>
          {governorate && <p className="muted">Showing games in your governorate. <Link to="/sports?district=all">See all governorates</Link></p>}
          <RoomList Card={HomeGameCard} rooms={games} sports={sports.data} loading={rooms.loading} error={rooms.error} onRetry={reloadRooms} onPreview={setSelectedRoom} emptyTitle="No upcoming games" emptyDescription="No public games are scheduled yet. Check back soon." />
        </section>
        <footer className="home-footer">
          <p className="home-footer-brand"><Logo size={26} /><span className="muted">Adults 18+ · Bahrain time</span></p>
          <p className="home-footer-note">Public browsing. Sign in to join or host.</p>
        </footer>
      </div>
      {selectedRoom && <RoomPreviewDialog key={`${selectedRoom.id}-${session.user?.id || 'guest'}`} session={session} room={selectedRoom} sportName={sports.data.find((sport) => sport.id === selectedRoom.sport_id)?.name} onClose={() => setSelectedRoom(null)} onUpdated={reloadRooms} />}
    </main>
  );
}
