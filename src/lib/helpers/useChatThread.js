import { useEffect, useState } from 'react';
import messageService from '../../services/messageService';
import { mergeMessages } from '../../services/websocketService';
import { THREAD_PAGE_SIZE } from './messages';
import { emptyResource, startRequest } from './request';

export default function useChatThread(type, id) {
  const [resource, setResource] = useState(() => emptyResource(null));
  const [retry, setRetry] = useState(0);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState('');

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

  return {
    messages: resource.data?.messages ?? [],
    hasMore: resource.data?.hasMore ?? false,
    loading: resource.loading,
    error: resource.error,
    loadingEarlier,
    earlierError,
    loadEarlier,
    reload: () => setRetry((count) => count + 1),
  };
}
