import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { formatUnreadCount } from '../../lib/helpers/messages';

function SignedInAccount({ user, signOut }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSignOut() {
    setPending(true);
    setError('');
    try { await signOut(); }
    catch { setError('Signed out on this device. The server could not confirm logout.'); }
    finally { setPending(false); }
  }

  return <>
    <Link className="button-primary nav-cta" to="/rooms/new">Host a room</Link>
    <UserMenu user={user} pending={pending} onSignOut={handleSignOut} />
    {error && <p className="nav-error" role="alert">{error}</p>}
  </>;
}

export default function NavBar({ session, unreadCount = 0, messageUnread = 0, liveStatus = 'idle' }) {
  const { user, loading, signOut } = session;

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
        <NavLink to="/messages">Messages{messageUnread > 0 && ` (${formatUnreadCount(messageUnread)})`}</NavLink>
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
    <div className="site-header-account">
      {['connecting', 'reconnecting', 'error'].includes(liveStatus) && <span className="nav-status" role="status">Reconnecting…</span>}
      {loading ? <span className="nav-status" role="status">Restoring session…</span> : user ? <SignedInAccount key={user.id} user={user} signOut={signOut} /> : <>
        <Link className="nav-plain" to="/sign-up">Sign up</Link>
        <Link className="header-google" to="/sign-in"><GoogleLogo size={20} />Sign in with Google</Link>
      </>}
    </div>
  </header>;
}
