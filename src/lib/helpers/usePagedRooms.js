import { useEffect, useRef, useState } from 'react';
import { listen } from '../../services/websocketService';
import { roomEvent } from './live';
import { emptyResource, startRequest } from './request';

const MAX_RELOAD_SIZE = 100;

export default function usePagedRooms({ searchKey, filterSet, fetchPage }) {
  const [list, setList] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [more, setMore] = useState({ pending: false, error: '' });
  const loadedKey = useRef('');
  const loadedCount = useRef(0);
  const fetchRef = useRef(fetchPage);
  const current = list.data?.key === searchKey ? list.data : null;

  useEffect(() => { fetchRef.current = fetchPage; });

  useEffect(() => startRequest(async (signal) => {
    const values = filterSet.get(new URLSearchParams(searchKey));
    const problem = filterSet.validate(values);
    if (problem) throw new Error(problem);
    const sameFilters = loadedKey.current === searchKey;
    loadedKey.current = searchKey;
    const limit = sameFilters
      ? Math.min(Math.max(loadedCount.current, filterSet.pageSize), MAX_RELOAD_SIZE)
      : filterSet.pageSize;
    const page = await fetchRef.current(filterSet.toQuery(values, { limit }), signal);
    return { key: searchKey, items: page.items, total: page.total, hasMore: page.has_more };
  }, setList), [searchKey, retry, filterSet]);

  useEffect(() => { loadedCount.current = current?.items.length ?? 0; }, [current]);

  useEffect(() => listen((event) => {
    if (event.type === 'connection.ready' || roomEvent(event)) setRetry((count) => count + 1);
  }), []);

  async function loadMore() {
    if (!current || more.pending) return;
    setMore({ pending: true, error: '' });
    try {
      const values = filterSet.get(new URLSearchParams(searchKey));
      const page = await fetchRef.current(filterSet.toQuery(values, { offset: current.items.length }));
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

  return {
    current,
    error: list.error,
    loading: !current && !list.error,
    more,
    loadMore,
    reload: () => setRetry((count) => count + 1),
  };
}
