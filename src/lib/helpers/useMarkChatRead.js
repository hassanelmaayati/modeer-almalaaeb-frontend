import { useEffect, useRef } from 'react';
import notificationService from '../../services/notificationService';

export default function useMarkChatRead(chatId, ids) {
  const inFlight = useRef(new Set());
  const list = ids.join(',');

  useEffect(() => {
    if (!chatId || !list) return;
    const fresh = list.split(',').map(Number).filter((id) => !inFlight.current.has(id));
    fresh.forEach((id) => inFlight.current.add(id));
    fresh.forEach((id) => notificationService.markRead(id).catch(() => {}).finally(() => inFlight.current.delete(id)));
  }, [chatId, list]);
}
