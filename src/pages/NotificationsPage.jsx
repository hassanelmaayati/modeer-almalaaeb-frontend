import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import notificationService from '../services/notificationService';
import { listen } from '../services/websocketService';
import { emptyResource, startRequest } from '../lib/helpers/request';
import { notificationDestination } from '../lib/helpers/live';
import { ACTIVITY_TIME_ZONE, formatActivityDate, formatActivityTime, parseDate } from '../lib/helpers/date';
import { demoNotifications } from '../lib/dev/demoNotifications';
import AsyncState from '../components/common/AsyncState';
import Icon from '../components/common/Icon';
import { NotificationsArt } from '../components/home/HeroArt';

// Dev-only preview: open /notifications?demo=1 to see the page filled with sample notifications.
const demoRequested = () => import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1';

const KIND_ICONS = { message: 'chat', friend: 'userplus', room: 'bolt', group: 'people', cup: 'trophy' };
const kindOf = notification => notification.kind?.split('.')[0];
const dayOf = value => { const date = parseDate(value); return date ? new Intl.DateTimeFormat('en-CA', { timeZone: ACTIVITY_TIME_ZONE }).format(date) : ''; };

function dayLabel(value) {
  const day = dayOf(value);
  if (day === dayOf(new Date())) return 'Today';
  if (day === dayOf(new Date(Date.now() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  return formatActivityDate(value);
}

export default function NotificationsPage({ session }) {
  const demo = demoRequested();
  const [resource, setResource] = useState(() => emptyResource({ items: [], unread_count: 0 }));
  const [demoItems, setDemoItems] = useState(() => demo ? demoNotifications() : []);
  const [retry, setRetry] = useState(0);
  const [before, setBefore] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const userId = session.user?.id;
  const reload = () => setRetry(value => value + 1);
  useEffect(() => userId && !demo ? startRequest(signal => notificationService.list({ limit: 50, before }, { signal }), setResource) : undefined, [userId, before, retry, demo]);
  useEffect(() => demo ? undefined : listen(event => { if (['connection.ready', 'notification.created', 'notifications.updated'].includes(event.type)) setRetry(value => value + 1); }), [demo]);

  async function markRead(id) {
    if (demo) {
      const now = new Date().toISOString();
      setDemoItems(items => items.map(item => (!id || item.id === id) && !item.read_at ? { ...item, read_at: now } : item));
      return;
    }
    setPending(true);
    setError('');
    try { await (id ? notificationService.markRead(id) : notificationService.markAllRead()); reload(); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }

  if (session.loading) return <main className="home notifications-scope"><div className="home-content"><p className="status-message" role="status">Restoring session…</p></div></main>;
  const banner = (children) => <section className="sports-banner notifications-banner" aria-labelledby="notifications-title">
    <NotificationsArt />
    <div>
      <p className="sports-banner-eyebrow">Invitations. Decisions. Updates.</p>
      <h1 id="notifications-title">Notifications</h1>
      <p>Invitations, admission decisions and updates to your activities.</p>
    </div>
    {children}
  </section>;
  if (!userId && !demo) return <main className="home notifications-scope"><div className="home-content">
    {banner(null)}
    <section className="home-section notification-panel">
      <h2>Stay in the loop</h2>
      <p className="home-subtitle">Sign in to see your notifications.</p>
      <Link className="button-primary" to="/sign-in">Sign in</Link>
    </section>
  </div></main>;

  const { items, unread_count: unreadCount } = demo
    ? { items: demoItems, unread_count: demoItems.filter(item => !item.read_at).length }
    : resource.data;
  return <main className="home notifications-scope">
    <div className="home-content">
      {banner(<div className="sports-banner-actions">
        <button type="button" className="button-primary" disabled={pending || !unreadCount} onClick={() => markRead()}>Mark all read</button>
      </div>)}
      {demo && <p className="notification-demo" role="note">Preview mode: these are sample notifications, not your real ones.</p>}
      {error && <p role="alert">{error}</p>}
      <section className="home-section" aria-labelledby="notifications-list-title">
        <div className="home-section-head">
          <div>
            <h2 id="notifications-list-title">Your updates</h2>
            <p className="home-subtitle">{!demo && (resource.loading || resource.error) ? 'Everything that needs your attention.' : unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}</p>
          </div>
        </div>
        <AsyncState loading={!demo && resource.loading} error={demo ? null : resource.error} onRetry={reload} isEmpty={!items.length} emptyTitle="No notifications yet">
          <ul className="notification-list">{items.map((notification, index) => {
            const destination = notificationDestination(notification);
            const unread = !notification.read_at;
            const newDay = index === 0 || dayOf(items[index - 1].created_at) !== dayOf(notification.created_at);
            return <li key={notification.id} className={`notification-card notification-kind-${kindOf(notification) || 'other'}${unread ? ' is-unread' : ''}${newDay ? ' starts-day' : ''}`}>
              {newDay && <span className="notification-day">{dayLabel(notification.created_at)}</span>}
              <span className="notification-icon" aria-hidden="true"><Icon name={KIND_ICONS[kindOf(notification)] || 'bell'} size={22} /></span>
              <div className="notification-body">
                <p className="notification-text">{notification.text}</p>
                <p className="muted notification-time">{formatActivityDate(notification.created_at)} · {formatActivityTime(notification.created_at)} Bahrain</p>
              </div>
              {unread && <span className="status-badge notification-unread">Unread</span>}
              <div className="notification-actions">
                {destination && <Link className="notification-open" to={destination} onClick={() => { if (unread) markRead(notification.id); }}>Open details</Link>}
                {unread && <button type="button" className="notification-mark" disabled={pending} onClick={() => markRead(notification.id)}>Mark read</button>}
              </div>
            </li>;
          })}</ul>
        </AsyncState>
        <div className="notification-paging">
          {before && <button type="button" className="button-secondary" onClick={() => setBefore(null)}>Latest notifications</button>}
          {items.length === 50 && <button type="button" className="button-secondary" disabled={resource.loading} onClick={() => setBefore(items.at(-1).id)}>Older notifications</button>}
        </div>
      </section>
    </div>
  </main>;
}
