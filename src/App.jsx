import { Route, Routes, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import NavBar from './components/layout/NavBar';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import CupsPage from './pages/CupsPage';
import CreateCupPage from './pages/CreateCupPage';
import CupPage from './pages/CupPage';
import RequireAuth from './components/auth/RequireAuth';
import HomePage from './pages/HomePage';
import GroupsPage from './pages/GroupsPage';
import SportsPage from './pages/SportsPage';
import RoomPage from './pages/RoomPage';
import CreateRoomPage from './pages/CreateRoomPage';
import NotificationsPage from './pages/NotificationsPage';
import notificationService from './services/notificationService';
import websocketService from './services/websocketService';
import { emptyResource, startRequest } from './lib/helpers/request';
import * as authService from './services/authService';
import * as googleAuthService from './services/googleAuthService';
import * as userService from './services/userService';
import { initialSession, watchUser, authenticate, signOut } from './lib/helpers/auth';
import './App.css';
import './users.css';
import './cups.css';

export default function App() {
  const [account, setAccount] = useState(initialSession);
  useEffect(() => watchUser(setAccount), []);
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
  const navigate = useNavigate();
  // Always land on home with replace after an account change, so Back can't reopen the previous account's page.
  const goHome = result => { navigate('/', { replace: true }); return result; };
  const session = {
    ...account,
    signOut: () => signOut().finally(goHome),
    signIn: body => authenticate(authService.signIn, body, setAccount).then(goHome),
    signUp: body => authenticate(authService.signUp, body, setAccount).then(goHome),
    signInWithGoogle: credential => authenticate(googleAuthService.signIn, { credential }, setAccount).then(goHome),
    // Lets Settings update the name shown in NavBar after a profile save.
    refreshUser: () => userService.getMe().then(user => setAccount(current => ({ ...current, user }))),
  };
  const accountKey = account.user?.id || 'guest';
  return <>
    <NavBar session={session} liveStatus={liveStatus} unreadCount={userId && notifications.data?.userId === userId ? notifications.data.unread_count : 0} />
    <Routes>
      <Route path="/" element={<HomePage key={accountKey} session={session} />} />

      <Route path="/groups" element={<GroupsPage key={accountKey} session={session} />} />

      <Route path="/sports" element={<SportsPage key={accountKey} session={session} />} />

      <Route path="/rooms/new" element={<RequireAuth session={session}><CreateRoomPage key={accountKey} session={session} /></RequireAuth>} />
      <Route path="/rooms/:roomId" element={<RoomPage key={accountKey} session={session} />} />

      <Route path="/notifications" element={<NotificationsPage key={accountKey} session={session} />} />

      <Route path="/users/:userId" element={<RequireAuth session={session}><ProfilePage key={accountKey} session={session} /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth session={session}><SettingsPage key={accountKey} session={session} /></RequireAuth>} />

      <Route path="/cups" element={<CupsPage key={accountKey} session={session} />} />
      <Route path="/cups/new" element={<RequireAuth session={session}><CreateCupPage key={accountKey} /></RequireAuth>} />
      <Route path="/cups/:cupId" element={<CupPage key={accountKey} session={session} />} />

      <Route path="/sign-in" element={<SignInPage session={session} />} />
      <Route path="/sign-up" element={<SignUpPage session={session} />} />

      <Route path="*" element={<main><h1>Page not found</h1><p>Use the navigation to return to a working page.</p></main>} />
    </Routes>
  </>;
}
