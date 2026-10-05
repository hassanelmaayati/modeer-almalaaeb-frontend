import { useState } from 'react';
import { Link, NavLink } from 'react-router';

export default function NavBar({ session, unreadCount = 0, liveStatus = 'idle' }) {
  const { user, loading, signOut } = session;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    setPending(true);
    setError('');
    try { await signOut(); }
    catch { setError('Signed out on this device. The server could not confirm logout.'); }
    finally { setPending(false); }
  }

  return <header className="site-header">
    <Link to="/">Modeer Almalaaeb</Link>
    <nav aria-label="Main navigation">
      <NavLink to="/" end>Home</NavLink>
      <NavLink to="/groups">Groups</NavLink>
      <NavLink to="/sports">Sports</NavLink>
      <NavLink to="/rooms/new">Host a room</NavLink>
      <NavLink to="/cups">Cups</NavLink>
      {loading ? <span role="status">Restoring session…</span> : user ? <>
        <NavLink to="/my-rooms">My rooms</NavLink>
        <NavLink to="/joined-rooms">Joined rooms</NavLink>
        <NavLink to="/friends">Friends</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <NavLink to="/notifications">Notifications{unreadCount > 0 && ` (${unreadCount})`}</NavLink>
        {['connecting', 'reconnecting', 'error'].includes(liveStatus) && <span role="status">Live updates reconnecting…</span>}
        <span>Signed in as {user.user_name}</span>
        <button type="button" onClick={handleSignOut} disabled={pending}>{pending ? 'Signing out…' : 'Sign out'}</button>
      </> : <>
        <NavLink to="/sign-in">Sign in</NavLink>
        <NavLink to="/sign-up">Sign up</NavLink>
      </>}
    </nav>
    {error && <p role="alert">{error}</p>}
  </header>;
}
