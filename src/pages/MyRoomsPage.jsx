import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import CreateRoomAction from '../components/activities/CreateRoomAction';
import MyRoomCard from '../components/activities/MyRoomCard';
import MyRoomFilters from '../components/activities/MyRoomFilters';
import MyRoomViewTabs from '../components/activities/MyRoomViewTabs';
import RoomList from '../components/activities/RoomList';
import {
  getMyRoomFilters,
  MY_ROOMS_PAGE_SIZE,
  myRoomFiltersToSearchParams,
  resolveMyRoomFilters,
  toMyRoomsQuery,
  validateMyRoomFilters,
} from '../lib/helpers/filters';
import { roomEvent } from '../lib/helpers/live';
import { emptyResource, startRequest } from '../lib/helpers/request';
import roomService from '../services/roomService';
import sportService from '../services/sportService';
import { listen } from '../services/websocketService';

const MAX_RELOAD_SIZE = 100;

export default function MyRoomsPage({ session }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sports, setSports] = useState(() => emptyResource([]));
  const [list, setList] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [more, setMore] = useState({ pending: false, error: '' });
  const loadedKey = useRef('');
  const loadedCount = useRef(0);

  const searchKey = searchParams.toString();
  const filters = getMyRoomFilters(searchParams);
  const resolved = resolveMyRoomFilters(filters);
  const current = list.data?.key === searchKey ? list.data : null;

  useEffect(() => startRequest((signal) => sportService.list({ signal }), setSports), []);

  useEffect(() => startRequest(async (signal) => {
    const values = getMyRoomFilters(new URLSearchParams(searchKey));
    const problem = validateMyRoomFilters(values);
    if (problem) throw new Error(problem);
    const sameFilters = loadedKey.current === searchKey;
    loadedKey.current = searchKey;
    const limit = sameFilters
      ? Math.min(Math.max(loadedCount.current, MY_ROOMS_PAGE_SIZE), MAX_RELOAD_SIZE)
      : MY_ROOMS_PAGE_SIZE;
    const page = await roomService.listMine(toMyRoomsQuery(values, { limit }), { signal });
    return { key: searchKey, items: page.items, total: page.total, hasMore: page.has_more };
  }, setList), [searchKey, retry]);

  useEffect(() => { loadedCount.current = current?.items.length ?? 0; }, [current]);

  useEffect(() => listen((event) => {
    if (event.type === 'connection.ready' || roomEvent(event)) setRetry((count) => count + 1);
  }), []);

  async function loadMore() {
    if (!current || more.pending) return;
    setMore({ pending: true, error: '' });
    try {
      const values = getMyRoomFilters(new URLSearchParams(searchKey));
      const page = await roomService.listMine(toMyRoomsQuery(values, { offset: current.items.length }));
      setList((previous) => {
        if (previous.data?.key !== searchKey) return previous;
        const known = new Set(previous.data.items.map((room) => room.id));
        const items = [...previous.data.items, ...page.items.filter((room) => !known.has(room.id))];
        return { ...previous, data: { ...previous.data, items, total: page.total, hasMore: page.has_more } };
      });
      setMore({ pending: false, error: '' });
    } catch (failure) {
      setMore({ pending: false, error: failure.message });
    }
  }

  return <main>
    <header className="page-header">
      <h1>My rooms</h1>
      <p>Rooms you host. Use History to look back at rooms that have ended.</p>
      <CreateRoomAction session={session} className="button" />
    </header>
    <MyRoomViewTabs filters={filters} />
    <MyRoomFilters
      key={searchKey}
      filters={resolved}
      sports={sports.data}
      onApply={(values) => setSearchParams(myRoomFiltersToSearchParams(values))}
      onClear={() => setSearchParams({})}
    />
    <RoomList
      rooms={current?.items ?? []}
      sports={sports.data}
      loading={!current && !list.error}
      error={list.error}
      onRetry={() => setRetry((count) => count + 1)}
      Card={MyRoomCard}
      emptyTitle="No rooms found"
      emptyDescription="Try another view or clear the filters."
    />
    {current && current.total > 0 && <p className="muted" role="status">Showing {current.items.length} of {current.total} rooms</p>}
    {current?.hasMore && <button type="button" className="button-secondary" disabled={more.pending} onClick={loadMore}>
      {more.pending ? 'Loading…' : 'Load more'}
    </button>}
    {more.error && <p role="alert" className="error-message">{more.error}</p>}
  </main>;
}
