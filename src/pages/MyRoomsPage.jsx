import { useSearchParams } from 'react-router';
import MyRoomViewTabs from '../components/activities/MyRoomViewTabs';
import { getMyRoomFilters, MY_ROOM_VIEWS, resolveMyRoomFilters } from '../lib/helpers/filters';

export default function MyRoomsPage() {
  const [searchParams] = useSearchParams();
  const filters = getMyRoomFilters(searchParams);
  const view = MY_ROOM_VIEWS.find(({ value }) => value === resolveMyRoomFilters(filters).view);
  return <main>
    <header className="page-header">
      <h1>My rooms</h1>
      <p>Rooms you host. Use History to look back at rooms that have ended.</p>
    </header>
    <MyRoomViewTabs filters={filters} />
    <p className="muted" role="status">Showing: {view.label}</p>
  </main>;
}
