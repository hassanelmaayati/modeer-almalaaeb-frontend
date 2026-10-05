import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import MyRoomFilters from '../components/activities/MyRoomFilters';
import MyRoomViewTabs from '../components/activities/MyRoomViewTabs';
import { getMyRoomFilters, MY_ROOM_VIEWS, myRoomFiltersToSearchParams, resolveMyRoomFilters } from '../lib/helpers/filters';
import { emptyResource, startRequest } from '../lib/helpers/request';
import sportService from '../services/sportService';

export default function MyRoomsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sports, setSports] = useState(() => emptyResource([]));
  const filters = getMyRoomFilters(searchParams);
  const resolved = resolveMyRoomFilters(filters);
  const view = MY_ROOM_VIEWS.find(({ value }) => value === resolved.view);

  useEffect(() => startRequest((signal) => sportService.list({ signal }), setSports), []);

  return <main>
    <header className="page-header">
      <h1>My rooms</h1>
      <p>Rooms you host. Use History to look back at rooms that have ended.</p>
    </header>
    <MyRoomViewTabs filters={filters} />
    <MyRoomFilters
      key={searchParams.toString()}
      filters={resolved}
      sports={sports.data}
      onApply={(values) => setSearchParams(myRoomFiltersToSearchParams(values))}
      onClear={() => setSearchParams({})}
    />
    <p className="muted" role="status">Showing: {view.label}</p>
  </main>;
}
