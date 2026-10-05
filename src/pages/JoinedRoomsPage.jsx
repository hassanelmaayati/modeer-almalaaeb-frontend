import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import JoinedRoomCard from '../components/activities/JoinedRoomCard';
import RoomList from '../components/activities/RoomList';
import RoomListFilters from '../components/activities/RoomListFilters';
import RoomViewTabs from '../components/activities/RoomViewTabs';
import { joinedRoomFilters } from '../lib/helpers/filters';
import { emptyResource, startRequest } from '../lib/helpers/request';
import usePagedRooms from '../lib/helpers/usePagedRooms';
import roomService from '../services/roomService';
import sportService from '../services/sportService';

const FILTER_FIELDS = ['membership', 'status', 'sport_id', 'requested', 'dates', 'order'];

const fetchJoinedRooms = (query, signal) => roomService.listJoined(query, { signal });

export default function JoinedRoomsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sports, setSports] = useState(() => emptyResource([]));
  const searchKey = searchParams.toString();
  const filters = joinedRoomFilters.get(searchParams);
  const resolved = joinedRoomFilters.resolve(filters);
  const rooms = usePagedRooms({ searchKey, filterSet: joinedRoomFilters, fetchPage: fetchJoinedRooms });
  const { current } = rooms;

  useEffect(() => startRequest((signal) => sportService.list({ signal }), setSports), []);

  return <main>
    <header className="page-header">
      <h1>Joined rooms</h1>
      <p>Rooms hosted by other people that you have joined, asked to join or been invited to.</p>
      <Link className="button" to="/sports">Browse activities</Link>
    </header>
    <RoomViewTabs filterSet={joinedRoomFilters} filters={filters} />
    <RoomListFilters
      key={searchKey}
      filterSet={joinedRoomFilters}
      filters={resolved}
      sports={sports.data}
      fields={FILTER_FIELDS}
      onApply={(values) => setSearchParams(joinedRoomFilters.toSearchParams(values))}
      onClear={() => setSearchParams({})}
    />
    <RoomList
      rooms={current?.items ?? []}
      sports={sports.data}
      loading={rooms.loading}
      error={rooms.error}
      onRetry={rooms.reload}
      Card={JoinedRoomCard}
      emptyTitle="No rooms found"
      emptyDescription="Try another view or change the filters."
    />
    {current && current.total > 0 && <p className="muted" role="status">Showing {current.items.length} of {current.total} rooms</p>}
    {current?.hasMore && <button type="button" className="button-secondary" disabled={rooms.more.pending} onClick={rooms.loadMore}>
      {rooms.more.pending ? 'Loading…' : 'Load more'}
    </button>}
    {rooms.more.error && <p role="alert" className="error-message">{rooms.more.error}</p>}
  </main>;
}
