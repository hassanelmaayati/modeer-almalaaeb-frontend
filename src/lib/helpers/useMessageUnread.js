import { useEffect, useMemo, useState } from 'react';
import notificationService from '../../services/notificationService';
import { listen } from '../../services/websocketService';
import { NO_UNREAD, summarizeUnread } from './messages';
import { emptyResource, startRequest } from './request';

const UNREAD_EVENTS = ['connection.ready', 'notification.created', 'notifications.updated'];

async function loadUnread(userId, signal) {
  const items = new Map();
  let before;
  while (!signal.aborted) {
    const page = await notificationService.list({ unread_only: true, limit: 100, ...(before ? { before } : {}) }, { signal });
    for (const notification of page.items) items.set(notification.id, notification);
    const next = page.items.at(-1)?.id;
    if (page.items.length < 100 || !Number.isInteger(next) || next < 1 || (before && next >= before)) break;
    before = next;
  }
  return { userId, items: [...items.values()] };
}

export default function useMessageUnread(userId) {
  const [resource, setResource] = useState(() => emptyResource(null));
  const [revision, setRevision] = useState(0);

  useEffect(() => listen((event) => {
    if (UNREAD_EVENTS.includes(event.type)) setRevision((value) => value + 1);
  }), []);

  useEffect(() => (userId
    ? startRequest(signal => loadUnread(userId, signal), setResource)
    : undefined), [userId, revision]);

  const items = userId && resource.data?.userId === userId ? resource.data.items : null;
  return useMemo(() => (userId && items ? summarizeUnread(items) : NO_UNREAD), [userId, items]);
}
