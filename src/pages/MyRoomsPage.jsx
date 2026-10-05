import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import CreateRoomAction from '../components/activities/CreateRoomAction';
import MyRoomCard from '../components/activities/MyRoomCard';
import RoomList from '../components/activities/RoomList';
import RoomListFilters from '../components/activities/RoomListFilters';
import RoomViewTabs from '../components/activities/RoomViewTabs';
import { myRoomFilters, myRoomsEmptyState } from '../lib/helpers/filters';
import { emptyResource, startRequest } from '../lib/helpers/request';
import usePagedRooms from '../lib/helpers/usePagedRooms';
import roomService from '../services/roomService';
import sportService from '../services/sportService';

const FILTER_FIELDS = ['status', 'sport_id', 'visibility', 'dates', 'order'];

const fetchMyRooms = (query, signal) => roomService.listMine(query, { signal });

export default function MyRoomsPage({ session }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sports, setSports] = useState(() => emptyResource([]));
  const searchKey = searchParams.toString();
  const filters = myRoomFilters.get(searchParams);
  const resolved = myRoomFilters.resolve(filters);
  const empty = myRoomsEmptyState(filters);
  const rooms = usePagedRooms({ searchKey, filterSet: myRoomFilters, fetchPage: fetchMyRooms });
  const { current } = rooms;

  useEffect(() => startRequest((signal) => sportService.list({ signal }), setSports), []);

  return <main>
    <header className="page-header">
      <h1>My rooms</h1>
      <p>Rooms you host. Use History to look back at rooms that have ended.</p>
      <CreateRoomAction session={session} className="button" />
    </header>
    <RoomViewTabs filterSet={myRoomFilters} filters={filters} />
    <RoomListFilters
      key={searchKey}
      filterSet={myRoomFilters}
      filters={resolved}
      sports={sports.data}
      fields={FILTER_FIELDS}
      onApply={(values) => setSearchParams(myRoomFilters.toSearchParams(values))}
      onClear={() => setSearchParams({})}
    />
    <RoomList
      rooms={current?.items ?? []}
      sports={sports.data}
      loading={rooms.loading}
      error={rooms.error}
      onRetry={rooms.reload}
      Card={MyRoomCard}
      emptyTitle={empty.title}
      emptyDescription={empty.description}
      emptyAction={empty.action === 'host'
        ? <CreateRoomAction session={session} className="button" />
        : empty.action === 'clear'
          ? <button type="button" className="button-secondary" onClick={() => setSearchParams({})}>Clear filters</button>
          : null}
    />
    {current && current.total > 0 && <p className="muted" role="status">Showing {current.items.length} of {current.total} rooms</p>}
    {current?.hasMore && <button type="button" className="button-secondary" disabled={rooms.more.pending} onClick={rooms.loadMore}>
      {rooms.more.pending ? 'Loading…' : 'Load more'}
    </button>}
    {rooms.more.error && <p role="alert" className="error-message">{rooms.more.error}</p>}
  </main>;
}
