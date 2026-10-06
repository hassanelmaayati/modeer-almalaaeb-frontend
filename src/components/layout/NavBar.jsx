import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { formatUnreadCount } from '../../lib/helpers/messages';
import { GoogleLogo } from '../common/Icon';
import Logo from '../common/Logo';
import UserMenu from './UserMenu';

function CountBadge({ count, label }) {
  if (count <= 0) return null;
  return <span className="nav-badge" aria-label={`${count} unread ${label}`}>{formatUnreadCount(count)}</span>;
}

export default function NavBar({ session, unreadCount = 0, messageUnread = 0, liveStatus = 'idle' }) {
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
    <Link className="brand" to="/" aria-label="Modeer Almalaaeb home"><Logo size={44} /></Link>
    <nav aria-label="Main navigation">
      <NavLink to="/sports">Find games</NavLink>
      <NavLink to="/cups">Cups</NavLink>
      <NavLink to="/groups">Groups</NavLink>
      {user && <>
        <NavLink to="/messages">Messages<CountBadge count={messageUnread} label="messages" /></NavLink>
        <NavLink to="/notifications">Notifications<CountBadge count={unreadCount} label="notifications" /></NavLink>
      </>}
    </nav>
    <div className="site-header-account">
      {['connecting', 'reconnecting', 'error'].includes(liveStatus) && <span className="nav-status" role="status">Reconnecting…</span>}
      {loading ? <span className="nav-status" role="status">Restoring session…</span> : user ? <>
        <Link className="button-primary nav-cta" to="/rooms/new">Host a room</Link>
        <UserMenu user={user} pending={pending} onSignOut={handleSignOut} />
      </> : <>
        <Link className="nav-plain" to="/sign-up">Sign up</Link>
        <Link className="header-google" to="/sign-in"><GoogleLogo size={20} />Sign in with Google</Link>
      </>}
    </div>
    {error && <p className="nav-error" role="alert">{error}</p>}
  </header>;
}
