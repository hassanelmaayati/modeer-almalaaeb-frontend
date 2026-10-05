import { useEffect, useState } from 'react';
import messageService from '../../services/messageService';
import { mergeMessages } from '../../services/websocketService';
import { sendBlockReason, THREAD_PAGE_SIZE, validateMessageBody } from './messages';
import { emptyResource, startRequest } from './request';

export default function useChatThread(type, id) {
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState('');
  const [pending, setPending] = useState([]);
  const [blockedReason, setBlockedReason] = useState('');

  useEffect(() => startRequest(
    (signal) => messageService
      .list({ ...messageService.targetQuery({ type, id }), limit: THREAD_PAGE_SIZE }, { signal })
      .then((page) => ({ messages: mergeMessages([], page), hasMore: page.length === THREAD_PAGE_SIZE })),
    setResource,
  ), [type, id, retry]);

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

  return {
    messages: resource.data?.messages ?? [],
    hasMore: resource.data?.hasMore ?? false,
    loading: resource.loading,
    error: resource.error,
    loadingEarlier,
    earlierError,
    loadEarlier,
    reload: () => setRetry((count) => count + 1),
    pending,
    blockedReason,
    send,
    retrySend,
    discard,
  };
}
