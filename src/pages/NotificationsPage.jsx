import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import notificationService from '../services/notificationService';
import { listen } from '../services/websocketService';
import { emptyResource, startRequest } from '../lib/helpers/request';
import { notificationDestination } from '../lib/helpers/live';
import { formatActivityDate, formatActivityTime } from '../lib/helpers/date';
import AsyncState from '../components/common/AsyncState';

export default function NotificationsPage({ session }) {
  const [resource, setResource] = useState(() => emptyResource({ items: [], unread_count: 0 }));
  const [retry, setRetry] = useState(0);
  const [before, setBefore] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const userId = session.user?.id;
  const reload = () => setRetry(value => value + 1);
  useEffect(() => userId ? startRequest(signal => notificationService.list({ limit: 50, before }, { signal }), setResource) : undefined, [userId, before, retry]);
  useEffect(() => listen(event => { if (['connection.ready', 'notification.created', 'notifications.updated'].includes(event.type)) setRetry(value => value + 1); }), []);

  async function markRead(id) {
    setPending(true);
    setError('');
    try { await (id ? notificationService.markRead(id) : notificationService.markAllRead()); reload(); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  if (session.loading) return <main><p role="status">Restoring session…</p></main>;
  if (!userId) return <main><h1>Notifications</h1><p>Sign in to see your notifications.</p><Link to="/sign-in">Sign in</Link></main>;
  const { items, unread_count: unreadCount } = resource.data;
  return <main>
    <header className="page-header"><h1>Notifications</h1><p>Invitations, admission decisions and updates to your activities.</p>
      <button type="button" disabled={pending || !unreadCount} onClick={() => markRead()}>Mark all read</button>
    </header>
    {error && <p role="alert">{error}</p>}
    <AsyncState loading={resource.loading} error={resource.error} onRetry={reload} isEmpty={!items.length} emptyTitle="No notifications yet">
      <ul className="notification-list">{items.map(notification => {
        const destination = notificationDestination(notification);
        return <li key={notification.id} className="panel">
          {!notification.read_at && <span className="status-badge">Unread</span>}
          <p>{notification.text}</p><p className="muted">{formatActivityDate(notification.created_at)} · {formatActivityTime(notification.created_at)} Bahrain</p>
          <div className="button-row">
            {destination && <Link to={destination} onClick={() => { if (!notification.read_at) markRead(notification.id); }}>Open details</Link>}
            {!notification.read_at && <button type="button" disabled={pending} onClick={() => markRead(notification.id)}>Mark read</button>}
          </div>
        </li>;
      })}</ul>
    </AsyncState>
    <div className="button-row">
      {before && <button type="button" onClick={() => setBefore(null)}>Latest notifications</button>}
      {items.length === 50 && <button type="button" disabled={resource.loading} onClick={() => setBefore(items.at(-1).id)}>Older notifications</button>}
    </div>
  </main>;
}
