import { useEffect, useRef, useState } from 'react';
import messageService from '../../services/messageService';
import userService from '../../services/userService';
import { listen } from '../../services/websocketService';
import { applyMessage, sortConversations } from './messages';
import { emptyResource, startRequest } from './request';

const RELOAD_EVENTS = ['connection.ready', 'friend.updated', 'room.updated', 'group.updated'];

function load(options) {
  return Promise.all([
    messageService.conversations({ include_empty: true, limit: 100 }, options),
    userService.list(options),
  ]).then(([conversations, users]) => ({ conversations: sortConversations(conversations), users }));
}

export default function useConversations(viewerId) {
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const latest = useRef({ viewerId, data: null });

  useEffect(() => { latest.current = { viewerId, data: resource.data }; });

  useEffect(() => startRequest((signal) => load({ signal }), setResource), [viewerId, retry]);

  useEffect(() => {
    // Route live refreshes through the cancellable effect, so old responses cannot replace a newer inbox.
    const refresh = () => setRetry(count => count + 1);

    return listen((event) => {
      if (RELOAD_EVENTS.includes(event.type)) {
        refresh();
        return;
      }
      if (event.type !== 'message.created' || !event.message || !latest.current.data) return;
      const next = applyMessage(latest.current.data.conversations, event.message, latest.current.viewerId);
      if (next === null) {
        refresh();
        return;
      }
      setResource((previous) => (previous.data ? { ...previous, data: { ...previous.data, conversations: next } } : previous));
    });
  }, []);

  return {
    conversations: resource.data?.conversations ?? [],
    users: resource.data?.users ?? [],
    loading: resource.loading,
    error: resource.error,
    reload: () => setRetry((count) => count + 1),
  };
}
