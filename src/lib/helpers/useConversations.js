import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import messageService from '../../services/messageService';
import useUsers from './userDirectory';
import { listen } from '../../services/websocketService';
import { applyMessage, applyMessageChangeToConversations, sortConversations } from './messages';
import { emptyResource, startRequest } from './request';

const RELOAD_EVENTS = ['connection.ready', 'friend.updated', 'room.updated', 'group.updated'];

function load(options) {
  return messageService.conversations({ include_empty: true, limit: 100 }, options)
    .then(conversations => ({ conversations: sortConversations(conversations) }));
}

export default function useConversations(viewerId) {
  const [resource, setResource] = useState(() => ({ ...emptyResource(null), viewerId }));
  const currentResource = resource.viewerId === viewerId ? resource : emptyResource(null);
  const [retry, setRetry] = useState(0);
  const latest = useRef({ viewerId, data: null });

  useLayoutEffect(() => { latest.current = { viewerId, data: currentResource.data }; });

  useEffect(() => startRequest((signal) => load({ signal }), (update) => {
    setResource((previous) => {
      const current = previous.viewerId === viewerId ? previous : emptyResource(null);
      const next = typeof update === 'function' ? update(current) : update;
      if ([401, 403, 404].includes(next.error?.status)) {
        return { ...next, data: null, viewerId };
      }
      // Keep this account's last authorized inbox visible during transient refreshes.
      if (current.data && (next.loading || next.error)) {
        return { ...current, loading: false, error: null, viewerId };
      }
      return { ...next, viewerId };
    });
  }), [viewerId, retry]);

  useEffect(() => {
    // Route live refreshes through the cancellable effect, so old responses cannot replace a newer inbox.
    const refresh = () => setRetry(count => count + 1);

    return listen((event) => {
      if (RELOAD_EVENTS.includes(event.type)) {
        refresh();
        return;
      }
      if (event.type === 'message.updated' || event.type === 'message.deleted') {
        setResource((previous) => (previous.data
          ? { ...previous, data: { ...previous.data, conversations: applyMessageChangeToConversations(previous.data.conversations, event) } }
          : previous));
        return;
      }
      if (event.type !== 'message.created' || !event.message || !latest.current.data) return;
      const next = applyMessage(latest.current.data.conversations, event.message, latest.current.viewerId);
      if (next === null) {
        refresh();
        return;
      }
      const eventViewerId = latest.current.viewerId;
      setResource((previous) => {
        if (!previous.data || previous.viewerId !== eventViewerId) return previous;
        const conversations = applyMessage(previous.data.conversations, event.message, eventViewerId);
        return conversations === null ? previous : { ...previous, data: { ...previous.data, conversations } };
      });
    });
  }, []);

  const conversations = currentResource.data?.conversations ?? [];
  // Names are only needed for direct chats and last-message senders, and are looked up by id.
  const users = useUsers(conversations.flatMap(conversation => [conversation.user_id, conversation.last_message?.sender_id]));

  return {
    conversations,
    users,
    loading: currentResource.loading,
    error: currentResource.error,
    reload: () => setRetry((count) => count + 1),
  };
}
