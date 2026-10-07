import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { lazy, Suspense, useRef, useState, useEffect } from 'react';
import NavBar from './components/layout/NavBar';
import AppNotices from './components/layout/AppNotices';
import { watchServerWaking } from './lib/api/client';
import { routeTitle } from './lib/helpers/routeTitles';
import RequireAuth from './components/auth/RequireAuth';
import HomePage from './pages/HomePage';
import notificationService from './services/notificationService';
import websocketService from './services/websocketService';
import { emptyResource, startRequest } from './lib/helpers/request';
import useMessageUnread from './lib/helpers/useMessageUnread';
import { startScrollReplay } from './lib/helpers/scrollReplay';
import * as authService from './services/authService';
import * as googleAuthService from './services/googleAuthService';
import * as userService from './services/userService';
import { initialSession, watchUser, authenticate, signOut } from './lib/helpers/auth';
import './App.css';
import './home.css';
import './users.css';
import './cups.css';
import './ui.css';
import './theme.css'
import './motion.css';

// Route pages load on demand so the first visit doesn't download every page (and leaflet maps) up front.
const SignInPage = lazy(() => import('./pages/SignInPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const CupsPage = lazy(() => import('./pages/CupsPage'));
const CreateCupPage = lazy(() => import('./pages/CreateCupPage'));
const CupPage = lazy(() => import('./pages/CupPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const SportsPage = lazy(() => import('./pages/SportsPage'));
const RoomPage = lazy(() => import('./pages/RoomPage'));
const CreateRoomPage = lazy(() => import('./pages/CreateRoomPage'));
const MyRoomsPage = lazy(() => import('./pages/MyRoomsPage'));
const JoinedRoomsPage = lazy(() => import('./pages/JoinedRoomsPage'));
const EditRoomPage = lazy(() => import('./pages/EditRoomPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));

export default function App() {
  const [account, setAccount] = useState(initialSession);
  const retryRestore = useRef(null);
  useEffect(() => { const stop = watchUser(setAccount); retryRestore.current = stop.retry; return stop; }, []);
  const [waking, setWaking] = useState(false);
  useEffect(() => watchServerWaking(setWaking), []);
  useEffect(() => startScrollReplay(), []);
  const [notice, setNotice] = useState('');
  // True from the moment sign-out starts until it ends, so guarded pages send you home (not to sign-in) when the session clears.
  const [leaving, setLeaving] = useState(false);
  // Each page gets its own title, and focus moves to the content after a link was used, so keyboard and screen-reader users notice the change.
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const firstRoute = useRef(true);
  useEffect(() => {
    document.title = routeTitle(pathname);
    if (firstRoute.current) { firstRoute.current = false; return; }
    const active = document.activeElement;
    if (!active || active === document.body || active.closest('a, nav, header')) mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);
  const userId = account.user?.id;
  const [liveStatus, setLiveStatus] = useState('idle');
  const [notifications, setNotifications] = useState(() => emptyResource());
  const [notificationRevision, setNotificationRevision] = useState(0);
  useEffect(() => websocketService.startLobby(), []);
  useEffect(() => userId ? websocketService.start() : undefined, [userId]);
  useEffect(() => websocketService.watchStatus(setLiveStatus), []);
  useEffect(() => websocketService.listen(event => {
    if (['connection.ready', 'notification.created', 'notifications.updated'].includes(event.type)) setNotificationRevision(value => value + 1);
  }), []);
  useEffect(() => startRequest(async signal => userId ? {
    ...await notificationService.list({ limit: 1 }, { signal }), userId,
  } : null, setNotifications), [userId, notificationRevision]);
  const messageUnread = useMessageUnread(userId);
  const navigate = useNavigate();
  // Always land on home with replace after an account change, so Back can't reopen the previous account's page.
  const goHome = result => { navigate('/', { replace: true }); return result; };
  const session = {
    ...account,
    leaving,
    signOut: async () => {
      setLeaving(true);
      navigate('/', { replace: true });
      try { await signOut(); }
      catch { setNotice('You were signed out on this device, but the server could not confirm it. If this is a shared device, sign in and out again.'); }
      finally { setLeaving(false); }
    },
    signIn: body => authenticate(authService.signIn, body, setAccount).then(goHome),
    signUp: body => authenticate(authService.signUp, body, setAccount).then(goHome),
    signInWithGoogle: credential => authenticate(googleAuthService.signIn, { credential }, setAccount).then(goHome),
    // Lets Settings update the name shown in NavBar after a profile save.
    refreshUser: () => userService.getMe().then(user => setAccount(current => ({ ...current, user }))),
  };
  const accountKey = account.user?.id || 'guest';
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <NavBar session={session} liveStatus={liveStatus} messageUnread={messageUnread.total} unreadCount={userId && notifications.data?.userId === userId ? notifications.data.unread_count : 0} />
    <AppNotices waking={waking} offline={!!account.offline} onRetry={() => retryRestore.current?.()} notice={notice} onDismiss={() => setNotice('')} />
    <div id="main-content" ref={mainRef} tabIndex={-1}>
    <Suspense fallback={<main><p className="status-message" role="status">Loading…</p></main>}>
    <Routes>
      <Route path="/" element={<HomePage key={accountKey} session={session} />} />

      <Route path="/groups" element={<GroupsPage key={accountKey} session={session} />} />

      <Route path="/sports" element={<SportsPage key={accountKey} session={session} />} />

      <Route path="/rooms/new" element={<RequireAuth session={session}><CreateRoomPage key={accountKey} session={session} /></RequireAuth>} />
      <Route path="/my-rooms" element={<RequireAuth session={session}><MyRoomsPage key={accountKey} session={session} /></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth session={session}><MessagesPage key={accountKey} session={session} unread={messageUnread} /></RequireAuth>} />
      <Route path="/messages/:type/:id" element={<RequireAuth session={session}><MessagesPage key={accountKey} session={session} unread={messageUnread} /></RequireAuth>} />
      <Route path="/friends" element={<RequireAuth session={session}><FriendsPage key={accountKey} session={session} /></RequireAuth>} />
      <Route path="/joined-rooms" element={<RequireAuth session={session}><JoinedRoomsPage key={accountKey} /></RequireAuth>} />
      <Route path="/rooms/:roomId/edit" element={<RequireAuth session={session}><EditRoomPage key={accountKey} session={session} /></RequireAuth>} />
      <Route path="/rooms/:roomId" element={<RoomPage key={accountKey} session={session} />} />

      <Route path="/notifications" element={<NotificationsPage key={accountKey} session={session} />} />

      <Route path="/users/:userId" element={<ProfilePage key={accountKey} session={session} />} />
      <Route path="/settings" element={<RequireAuth session={session}><SettingsPage key={accountKey} session={session} /></RequireAuth>} />

      <Route path="/cups" element={<CupsPage key={accountKey} session={session} />} />
      <Route path="/cups/new" element={<RequireAuth session={session}><CreateCupPage key={accountKey} /></RequireAuth>} />
      <Route path="/cups/:cupId" element={<CupPage key={accountKey} session={session} />} />

      <Route path="/sign-in" element={<SignInPage session={session} />} />
      <Route path="/sign-up" element={<SignUpPage session={session} />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
    </div>
  </>;
}
