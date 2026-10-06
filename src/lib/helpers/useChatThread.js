import { useCallback, useEffect, useRef, useState } from 'react';
import messageService from '../../services/messageService';
import roomService from '../../services/roomService';
import { listen, mergeMessages, recoverMessages } from '../../services/websocketService';
import { CANCELLED_ROOM_MESSAGE, chatKey, messageConversationKey, receiveMessage, roomCancellation, sendBlockReason, THREAD_PAGE_SIZE, validateMessageBody } from './messages';
import { emptyResource, startRequest } from './request';

export default function useChatThread(type, id, viewerId) {
  const scope = `${chatKey(type, id)}:viewer:${viewerId}`;
  const [resource, setResource] = useState(() => emptyResource(null));
  const currentResource = resource.scope === scope ? resource : emptyResource(null);
  const [retry, setRetry] = useState(0);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState('');
  const [pending, setPending] = useState([]);
  const [blockedReason, setBlockedReason] = useState('');
  const [room, setRoom] = useState(null);
  const generation = useRef(0);
  const previousScope = useRef(scope);

  const revokeAccess = useCallback(failure => {
    if (![403, 404].includes(failure?.status)) return false;
    generation.current++;
    setResource({ scope, data: null, loading: false, error: failure });
    setPending([]);
    setEarlierError('');
    setLoadingEarlier(false);
    return true;
  }, [scope]);

  useEffect(() => {
    const invalidate = () => { generation.current++; };
    invalidate();
    const scopeChanged = previousScope.current !== scope;
    previousScope.current = scope;
    const stop = startRequest(
      (signal) => {
        if (scopeChanged) { setPending([]); setRoom(null); }
        return messageService
        .list({ ...messageService.targetQuery({ type, id }), limit: THREAD_PAGE_SIZE }, { signal })
        .then((page) => {
          if (!signal.aborted) { setBlockedReason(''); setLoadingEarlier(false); setEarlierError(''); }
          return { messages: mergeMessages([], page), hasMore: page.length === THREAD_PAGE_SIZE };
        })
        .catch(failure => { if (!signal.aborted) revokeAccess(failure); throw failure; });
      },
      update => setResource(previous => {
        const current = previous.scope === scope ? previous : emptyResource(null);
        const next = typeof update === 'function' ? update(current) : update;
        if (next.data && !next.loading && !next.error) {
          const existing = current.data?.messages ?? [];
          return { ...next, scope, data: {
            ...next.data,
            messages: mergeMessages(existing, next.data.messages),
            hasMore: current.data && existing.length >= next.data.messages.length ? current.data.hasMore : next.data.hasMore,
          } };
        }
        return { ...next, scope };
      }),
    );
    return () => { invalidate(); stop(); };
  }, [type, id, scope, retry, revokeAccess]);

  const latest = useRef({ messages: null, viewerId });

  useEffect(() => { latest.current = { messages: currentResource.data?.messages ?? null, viewerId, scope }; });

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
      const requestGeneration = generation.current;
      recoverMessages({ type, id }, existing)
        .then((messages) => {
          if (!active || requestGeneration !== generation.current) return;
          setResource((previous) => (previous.data ? { ...previous, data: { ...previous.data, messages: mergeMessages(previous.data.messages, messages) } } : previous));
          setPending((list) => list.filter((item) => !messages.some((message) => message.client_request_id === item.id)));
        })
        .catch(failure => { if (active && requestGeneration === generation.current) revokeAccess(failure); });
    }

    const stop = listen((event) => {
      const permissionChanged = (event.type === 'group.updated' && type === 'group' && String(event.group_id ?? event.group?.id) === String(id))
        || (event.type === 'room.updated' && type === 'room' && String(event.room_id ?? event.room?.id) === String(id));
      if (permissionChanged) {
        setRetry(count => count + 1);
        refreshRoom();
        return;
      }
      if (event.type === 'connection.ready') {
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
  }, [type, id, revokeAccess]);

  async function loadEarlier() {
    const current = currentResource.data;
    if (!current || !current.hasMore || loadingEarlier || current.messages.length === 0) return;
    setLoadingEarlier(true);
    setEarlierError('');
    const requestGeneration = generation.current;
    try {
      const page = await messageService.list({
        ...messageService.targetQuery({ type, id }),
        before: current.messages[0].id,
        limit: THREAD_PAGE_SIZE,
      });
      if (requestGeneration !== generation.current) return;
      setResource((previous) => previous.scope === scope && previous.data ? ({
        ...previous,
        data: { messages: mergeMessages(previous.data.messages, page), hasMore: page.length === THREAD_PAGE_SIZE },
      }) : previous);
    } catch (failure) {
      if (requestGeneration === generation.current && !revokeAccess(failure)) setEarlierError(failure.message);
    } finally {
      if (requestGeneration === generation.current) setLoadingEarlier(false);
    }
  }

  const update = (clientRequestId, changes) => setPending((list) => list.map((item) => (item.id === clientRequestId ? { ...item, ...changes } : item)));

  async function deliver(item) {
    update(item.id, { status: 'sending', error: '' });
    try {
      const saved = await messageService.create(messageService.targetBody({ type, id }, item.body, item.id));
      setResource((previous) => (previous.scope === scope && previous.data
        ? { ...previous, data: { ...previous.data, messages: mergeMessages(previous.data.messages, [saved]) } }
        : previous));
      setPending((list) => list.filter((entry) => entry.id !== item.id));
    } catch (failure) {
      if (latest.current.scope !== scope) return;
      const reason = sendBlockReason(failure, type);
      if (reason) setBlockedReason(reason);
      update(item.id, { status: 'failed', error: reason || failure.message, blocked: Boolean(reason) });
    }
  }

  function send(text) {
    if (validateMessageBody(text) || blockedReason || currentResource.loading || currentResource.error || !currentResource.data) return false;
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

  const allMessages = currentResource.data?.messages ?? [];
  const cancellation = type === 'room' ? roomCancellation(room, allMessages) : null;

  return {
    cancellation,
    messages: allMessages,
    hasMore: currentResource.data?.hasMore ?? false,
    loading: currentResource.loading,
    error: currentResource.error,
    loadingEarlier,
    earlierError,
    loadEarlier,
    reload: () => setRetry((count) => count + 1),
    pending: resource.scope === scope ? pending : [],
    blockedReason: cancellation ? CANCELLED_ROOM_MESSAGE : blockedReason,
    send,
    retrySend,
    discard,
  };
}
