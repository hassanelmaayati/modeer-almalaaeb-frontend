import { useEffect, useRef, useState } from 'react';
import messageService from '../../services/messageService';
import roomService from '../../services/roomService';
import { listen, mergeMessages, recoverMessages } from '../../services/websocketService';
import { CANCELLED_ROOM_MESSAGE, chatKey, messageConversationKey, receiveMessage, roomCancellation, sendBlockReason, THREAD_PAGE_SIZE, validateMessageBody } from './messages';
import { emptyResource, startRequest } from './request';

export default function useChatThread(type, id, viewerId) {
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState('');
  const [pending, setPending] = useState([]);
  const [blockedReason, setBlockedReason] = useState('');
  const [room, setRoom] = useState(null);

  useEffect(() => startRequest(
    (signal) => messageService
      .list({ ...messageService.targetQuery({ type, id }), limit: THREAD_PAGE_SIZE }, { signal })
      .then((page) => ({ messages: mergeMessages([], page), hasMore: page.length === THREAD_PAGE_SIZE })),
    setResource,
  ), [type, id, retry]);

  const latest = useRef({ messages: null, viewerId });

  useEffect(() => { latest.current = { messages: resource.data?.messages ?? null, viewerId }; });

  useEffect(() => {
    const key = chatKey(type, id);
    let active = true;

    function refreshRoom() {
      if (type !== 'room') return;
      roomService.get(id).then((value) => { if (active) setRoom(value); }).catch(() => {});
    }

    refreshRoom();

    function recover() {
      const existing = latest.current.messages;
      if (!existing) return;
      recoverMessages({ type, id }, existing)
        .then((messages) => {
          if (!active) return;
          setResource((previous) => (previous.data ? { ...previous, data: { ...previous.data, messages } } : previous));
          setPending((list) => list.filter((item) => !messages.some((message) => message.client_request_id === item.id)));
        })
        .catch(() => {});
    }

    const stop = listen((event) => {
      if (event.type === 'connection.ready' || (event.type === 'room.updated' && type === 'room' && String(event.room_id ?? event.room?.id) === String(id))) {
        recover();
        refreshRoom();
        return;
      }
      if (event.type !== 'message.created' || !event.message) return;
      if (messageConversationKey(event.message, latest.current.viewerId) !== key) return;
      setResource((previous) => {
        if (!previous.data) return previous;
        const next = receiveMessage({ messages: previous.data.messages, pending: [] }, event.message);
        return { ...previous, data: { ...previous.data, messages: next.messages } };
      });
      setPending((list) => receiveMessage({ messages: [], pending: list }, event.message).pending);
    });

    return () => { active = false; stop(); };
  }, [type, id]);

  async function loadEarlier() {
    const current = resource.data;
    if (!current || !current.hasMore || loadingEarlier || current.messages.length === 0) return;
    setLoadingEarlier(true);
    setEarlierError('');
    try {
      const page = await messageService.list({
        ...messageService.targetQuery({ type, id }),
        before: current.messages[0].id,
        limit: THREAD_PAGE_SIZE,
      });
      setResource((previous) => ({
        ...previous,
        data: { messages: mergeMessages(previous.data.messages, page), hasMore: page.length === THREAD_PAGE_SIZE },
      }));
    } catch (failure) {
      setEarlierError(failure.message);
    } finally {
      setLoadingEarlier(false);
    }
  }

  const update = (clientRequestId, changes) => setPending((list) => list.map((item) => (item.id === clientRequestId ? { ...item, ...changes } : item)));

  async function deliver(item) {
    update(item.id, { status: 'sending', error: '' });
    try {
      const saved = await messageService.create(messageService.targetBody({ type, id }, item.body, item.id));
      setResource((previous) => (previous.data
        ? { ...previous, data: { ...previous.data, messages: mergeMessages(previous.data.messages, [saved]) } }
        : previous));
      setPending((list) => list.filter((entry) => entry.id !== item.id));
    } catch (failure) {
      const reason = sendBlockReason(failure, type);
      if (reason) setBlockedReason(reason);
      update(item.id, { status: 'failed', error: reason || failure.message, blocked: Boolean(reason) });
    }
  }

  function send(text) {
    if (validateMessageBody(text) || blockedReason) return false;
    const item = { id: crypto.randomUUID(), body: text.trim(), status: 'sending', error: '', blocked: false };
    setPending((list) => [...list, item]);
    deliver(item);
    return true;
  }

  function retrySend(clientRequestId) {
    const item = pending.find((entry) => entry.id === clientRequestId);
    if (item && item.status === 'failed' && !blockedReason) deliver(item);
  }

  function discard(clientRequestId) {
    setPending((list) => list.filter((item) => item.id !== clientRequestId));
  }

  const allMessages = resource.data?.messages ?? [];
  const cancellation = type === 'room' ? roomCancellation(room, allMessages) : null;

  return {
    cancellation,
    messages: allMessages,
    hasMore: resource.data?.hasMore ?? false,
    loading: resource.loading,
    error: resource.error,
    loadingEarlier,
    earlierError,
    loadEarlier,
    reload: () => setRetry((count) => count + 1),
    pending,
    blockedReason: cancellation ? CANCELLED_ROOM_MESSAGE : blockedReason,
    send,
    retrySend,
    discard,
  };
}
