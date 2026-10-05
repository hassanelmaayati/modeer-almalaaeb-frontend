import { useEffect, useMemo, useState } from 'react';
import notificationService from '../../services/notificationService';
import { listen } from '../../services/websocketService';
import { NO_UNREAD, summarizeUnread } from './messages';
import { emptyResource, startRequest } from './request';

const UNREAD_EVENTS = ['connection.ready', 'notification.created', 'notifications.updated'];

export default function useMessageUnread(userId) {
  const [resource, setResource] = useState(() => emptyResource(null));
  const [revision, setRevision] = useState(0);

  useEffect(() => listen((event) => {
    if (UNREAD_EVENTS.includes(event.type)) setRevision((value) => value + 1);
  }), []);

  useEffect(() => (userId
    ? startRequest(async (signal) => {
      const page = await notificationService.list({ unread_only: true, limit: 100 }, { signal });
      return { userId, items: page.items };
    }, setResource)
    : undefined), [userId, revision]);

  const items = userId && resource.data?.userId === userId ? resource.data.items : null;
  return useMemo(() => (userId && items ? summarizeUnread(items) : NO_UNREAD), [userId, items]);
}
